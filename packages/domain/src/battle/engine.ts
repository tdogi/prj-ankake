import { getLane, setBoardOccupant } from "./board";
import { resolveAfterPlayPhase } from "./automaticPhases";
import { BATTLE_LANES, getCreaturePlayCost, increaseResonance, isResonanceActive, isWindResonanceDiscountAvailable, resonanceGain } from "./resonance";
import { validateBattleCommand } from "./validation";
import { getExecutablePlayEffects, hasTargetedSummonEffect } from "./effectPrograms";
import { resolveEffect } from "./effectResolver";
import { applyTerminalResult, evaluateBattleTerminal } from "./terminal";
import type { ExecutableEffectDefinition } from "./effectTypes";
import { toEffectSelection } from "./effectTypes";
import { resolveLifecycleEffects } from "./lifecycleEffects";
import type {
  BattleCardInstance,
  BattleCommand,
  BattleCommandResult,
  BattleEvent,
  BattleSide,
  BattleState,
  PlayerBattleState
} from "./types";

export const GameEngine = {
  submitCommand(state: BattleState, command: BattleCommand): BattleCommandResult {
    const issues = validateBattleCommand(state, command);
    if (issues.length > 0) {
      return {
        ok: false,
        state,
        issues
      };
    }

    switch (command.type) {
      case "summonCreature":
        return acceptSummon(state, command);
      case "castSpell":
        return acceptSpell(state, command);
      case "moveCreature":
        return acceptMove(state, command);
      case "endPlayPhase":
        return acceptEndPlayPhase(state, command.side);
      case "resign":
        return acceptResignation(state, command.side);
    }
  }
};

function acceptResignation(state: BattleState, side: BattleSide): BattleCommandResult {
  const sequence = state.eventCursor + 1;
  const terminalResult = evaluateBattleTerminal(
    state,
    { kind: "quit", losingSide: side },
    sequence
  );
  if (!terminalResult) {
    return {
      ok: false,
      state,
      issues: [{ code: "battle.terminal", message: "The battle has already ended." }]
    };
  }

  const resolution = applyTerminalResult(state, terminalResult, sequence);
  return {
    ok: true,
    state: resolution.state,
    events: resolution.events
  };
}

function acceptSummon(
  state: BattleState,
  command: Extract<BattleCommand, { type: "summonCreature" }>
): BattleCommandResult {
  const card = state.cardInstances[command.handInstanceId] as BattleCardInstance;
  const player = state.players[command.side];
  const lane = getLane(command.destination.column);
  const windDiscountUsed = isWindResonanceDiscountAvailable(state, command.side, lane);
  const paidCost = getCreaturePlayCost(state, command.side, card, lane);
  const resonance = increaseResonance(player.resonance, lane, card.attribute, resonanceGain(card.cost));
  const nextPlayer: PlayerBattleState = {
    ...player,
    handZone: player.handZone.filter((id) => id !== card.instanceId),
    currentPp: player.currentPp - paidCost,
    resonance,
    resonanceUsage: {
      ...player.resonanceUsage,
      wind: {
        ...player.resonanceUsage.wind,
        [lane]: player.resonanceUsage.wind[lane] || windDiscountUsed
      },
      dark: refreshDarkUsageOnActivation(player.resonance, resonance, player.resonanceUsage.dark)
    }
  };
  const sequence = state.eventCursor + 1;
  const events: readonly BattleEvent[] = [
    {
      sequence,
      type: "creature.summoned",
      side: command.side,
      instanceId: card.instanceId,
      message: `${labelSide(command.side)} summoned ${card.name}.`
    },
    {
      sequence: sequence + 1,
      type: "resonance.changed",
      side: command.side,
      instanceId: card.instanceId,
      message: `${card.attribute} resonance increased in the ${lane} lane.`
    }
  ];

  const summonedState: BattleState = {
      ...state,
      board: setBoardOccupant(state.board, command.destination, card.instanceId),
      players: {
        ...state.players,
        [command.side]: nextPlayer
      },
      cardInstances: {
        ...state.cardInstances,
        [card.instanceId]: {
          ...card,
          zone: "board",
          position: command.destination,
          boardEntrySequence: sequence,
          summonedThisTurn: true
        }
      },
      eventCursor: sequence + events.length - 1
    };
  const resolvedCard = { ...card, zone: "board" as const, position: command.destination };
  const summonEffects = !command.effectSelection && hasTargetedSummonEffect(card)
    ? []
    : getExecutablePlayEffects(resolvedCard);
  const resolution = resolveOrderedEffects(summonedState, card.instanceId, command.side,
    summonEffects, toEffectSelection(command.effectSelection));
  const effectEvents = resolution.events;
  // The played creature's summon effect was resolved above with the command
  // selection.  Drain only resulting events here so it cannot fire twice.
  // Lifecycle events allocate from eventCursor; advance it past resolved
  // summon-effect events before draining triggered summons.
  const stateBeforeLifecycle = {
    ...resolution.state,
    eventCursor: effectEvents.at(-1)?.sequence ?? summonedState.eventCursor
  };
  const lifecycle = resolveLifecycleEffects(stateBeforeLifecycle, effectEvents);
  if (!lifecycle.accepted) return triggerLoopRejected(state);
  return {
    ok: true,
    state: { ...lifecycle.state, eventCursor: lifecycle.events.at(-1)?.sequence ?? effectEvents.at(-1)?.sequence ?? summonedState.eventCursor },
    events: [...events, ...effectEvents, ...lifecycle.events],
    ...(resolution.effect ? { effect: resolution.effect } : {})
  };
}

function acceptSpell(
  state: BattleState,
  command: Extract<BattleCommand, { type: "castSpell" }>
): BattleCommandResult {
  const card = state.cardInstances[command.handInstanceId] as BattleCardInstance;
  const player = state.players[command.side];
  const movedToGraveyard: BattleCardInstance = {
    ...card,
    zone: "graveyard"
  };
  const spentState: BattleState = {
    ...state,
    players: {
      ...state.players,
      [command.side]: {
        ...player,
        handZone: player.handZone.filter((id) => id !== card.instanceId),
        graveyardZone: [...player.graveyardZone, card.instanceId],
        currentPp: player.currentPp - card.currentCost
      }
    },
    cardInstances: {
      ...state.cardInstances,
      [card.instanceId]: movedToGraveyard
    }
  };
  const resolution = resolveOrderedEffects(spentState, card.instanceId, command.side, getExecutablePlayEffects(card),
    toEffectSelection(command.effectSelection, command.targetInstanceId, command.targetBaseId));
  const resolvedState = resolution.state;
  const effectEvents = resolution.events;
  const firstEventSequence = state.eventCursor + effectEvents.length + 1;
  const events: readonly BattleEvent[] = [
    ...effectEvents,
    { sequence: firstEventSequence, type: "spell.resolved", side: command.side, instanceId: card.instanceId, message: `${labelSide(command.side)} cast ${card.name}.`, data: { effectSourceInstanceId: card.instanceId } },
    ...BATTLE_LANES.map((lane, index) => ({ sequence: firstEventSequence + 1 + index, type: "resonance.changed" as const, side: command.side, instanceId: card.instanceId, message: `${card.attribute} resonance increased in the ${lane} lane.` }))
  ];
  const nextPlayer = resolvedState.players[command.side];
  const resonance = BATTLE_LANES.reduce((current, lane) => increaseResonance(current, lane, card.attribute, 1), nextPlayer.resonance);
  // Lifecycle resolution allocates from state.eventCursor.  Advance the
  // staged cursor past *all* spell events first, otherwise a trigger emitted
  // by the effect can reuse an effect/spell sequence number.
  const stateBeforeLifecycle = { ...resolvedState, eventCursor: events.at(-1)?.sequence ?? state.eventCursor };
  const lifecycle = resolveLifecycleEffects(stateBeforeLifecycle, effectEvents);
  if (!lifecycle.accepted) return triggerLoopRejected(state);
  const lifecycleEvents = lifecycle.events;
  return {
    ok: true,
    state: {
      ...lifecycle.state,
      players: {
        ...lifecycle.state.players,
        [command.side]: {
          ...lifecycle.state.players[command.side],
          resonance,
          resonanceUsage: {
            ...lifecycle.state.players[command.side].resonanceUsage,
            dark: refreshDarkUsageOnActivation(nextPlayer.resonance, resonance, lifecycle.state.players[command.side].resonanceUsage.dark)
          }
        }
      },
      eventCursor: lifecycleEvents.at(-1)?.sequence ?? events.at(-1)?.sequence ?? state.eventCursor
    },
    events: [...events, ...lifecycleEvents],
    ...(resolution.effect ? { effect: resolution.effect } : {})
  };
}

/** Resolves catalog effect IDs in their declared order, feeding staged state
 * (including metadata.rng) and generated-event sequence into the next ID. */
function resolveOrderedEffects(
  initialState: BattleState,
  sourceInstanceId: string,
  controllerSide: BattleSide,
  effects: readonly ExecutableEffectDefinition[],
  selection: ReturnType<typeof toEffectSelection>
): { readonly state: BattleState; readonly events: readonly BattleEvent[]; readonly effect?: NonNullable<Extract<BattleCommandResult, { readonly ok: true }> ["effect"]> } {
  let state = initialState;
  const events: BattleEvent[] = [];
  let completedOperationCount = 0;
  let resolved = false;
  let firstFailure: NonNullable<Extract<BattleCommandResult, { readonly ok: true }> ["effect"]>["failedOperation"];
  for (const effect of effects) {
    const result = resolveEffect({ state, sourceInstanceId, controllerSide, effect, selection, firstSequence: initialState.eventCursor + events.length + 1 });
    if (!result.accepted) continue;
    state = result.state;
    events.push(...result.events);
    completedOperationCount += result.effect.completedOperationCount;
    resolved ||= result.effect.status === "resolved";
    firstFailure ??= result.effect.failedOperation;
  }
  return effects.length === 0 ? { state, events } : { state, events, effect: { status: resolved ? "resolved" : "fizzled", completedOperationCount, ...(firstFailure ? { failedOperation: firstFailure } : {}) } };
}

function acceptMove(
  state: BattleState,
  command: Extract<BattleCommand, { type: "moveCreature" }>
): BattleCommandResult {
  const card = state.cardInstances[command.creatureInstanceId] as BattleCardInstance;
  const destination = command.path[command.path.length - 1] as { column: number; row: number };
  const sequence = state.eventCursor + 1;
  const lane = getLane(command.origin.column);
  const player = state.players[command.side];
  const activatesWaterResonance = isResonanceActive(player.resonance, lane, "water")
    && !player.resonanceUsage.water[lane];
  const events: readonly BattleEvent[] = [
    {
      sequence,
      type: "creature.moved",
      side: command.side,
      instanceId: card.instanceId,
      message: `${labelSide(command.side)} moved ${card.name}.`
    }
  ];

  const movedState: BattleState = {
      ...state,
      board: setBoardOccupant(
        setBoardOccupant(state.board, command.origin, undefined),
        destination,
        card.instanceId
      ),
      players: activatesWaterResonance
        ? { ...state.players, [command.side]: { ...player, resonanceUsage: { ...player.resonanceUsage, water: { ...player.resonanceUsage.water, [lane]: true } } } }
        : state.players,
      cardInstances: {
        ...state.cardInstances,
        [card.instanceId]: {
          ...card,
          position: destination,
          movedThisTurn: true,
          ...(activatesWaterResonance ? { temporaryMovementBonus: (card.temporaryMovementBonus ?? 0) + 1 } : {})
        }
      },
      eventCursor: sequence
    };
  const resonanceEvents = activatesWaterResonance
    ? [...events, { sequence: sequence + 1, type: "resonance.effect-resolved" as const, side: command.side, instanceId: card.instanceId, message: `Water resonance increased ${card.name}'s movement.` }]
    : events;
  const resonanceState = activatesWaterResonance ? { ...movedState, eventCursor: sequence + 1 } : movedState;
  const lifecycle = resolveLifecycleEffects(resonanceState, resonanceEvents);
  if (!lifecycle.accepted) return triggerLoopRejected(state);
  return { ok: true, state: { ...lifecycle.state, eventCursor: lifecycle.events.at(-1)?.sequence ?? resonanceEvents.at(-1)?.sequence ?? sequence }, events: [...resonanceEvents, ...lifecycle.events] };
}

function acceptEndPlayPhase(state: BattleState, side: BattleSide): BattleCommandResult {
  const resolution = resolveAfterPlayPhase(state, side, state.eventCursor + 1);
  const lifecycle = resolveLifecycleEffects(resolution.state, resolution.events);
  if (!lifecycle.accepted) return triggerLoopRejected(state);
  const resetState = resetTurnFlags(lifecycle.state, side, lifecycle.state.activeSide);

  return {
    ok: true,
    state: resetState,
    events: [...resolution.events, ...lifecycle.events]
  };
}

function resetTurnFlags(state: BattleState, endingSide: BattleSide, nextSide: BattleSide): BattleState {
  const nextCards = Object.fromEntries(
    Object.entries(state.cardInstances).map(([id, card]) => [
      id,
      card.controllerSide === endingSide || card.controllerSide === nextSide
        ? {
          ...card,
          ...(card.controllerSide === nextSide ? {
            summonedThisTurn: false,
            movedThisTurn: false,
            effectUsesThisTurn: undefined
          } : {}),
          ...(card.controllerSide === endingSide ? { temporaryMovementBonus: undefined } : {})
          }
        : card
    ])
  );

  return {
    ...state,
    cardInstances: nextCards
  };
}

function refreshDarkUsageOnActivation(
  previous: PlayerBattleState["resonance"],
  next: PlayerBattleState["resonance"],
  usage: PlayerBattleState["resonanceUsage"]["dark"]
): PlayerBattleState["resonanceUsage"]["dark"] {
  return Object.fromEntries(BATTLE_LANES.map((lane) => [
    lane,
    !isResonanceActive(previous, lane, "dark") && isResonanceActive(next, lane, "dark")
      ? false
      : usage[lane]
  ])) as PlayerBattleState["resonanceUsage"]["dark"];
}

function labelSide(side: BattleSide): string {
  return side === "player" ? "Player" : "CPU";
}

function triggerLoopRejected(state: BattleState): BattleCommandResult {
  return { ok: false, state, issues: [{ code: "battle.effect.trigger-loop", path: "effects", message: "Lifecycle effect trigger limit was exceeded." }] };
}
