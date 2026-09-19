import type {
  BattleBaseId,
  BattleBaseKind,
  BattleBaseOwner,
  BattleCardInstance,
  CardAttribute,
  BattleSide,
  BattleState,
  BoardCoordinate,
  LegalAction,
  ResonanceMap
} from "@ankake/domain";
import {
  BATTLE_BASE_IDS,
  getEffectiveCreatureAttack,
  getEffectiveCreatureCurrentHp,
  getEffectiveCreatureMaxHp,
  getEffectiveCreatureMovement
} from "@ankake/domain";

export interface CpuVisibleCard {
  readonly instanceId: string;
  readonly catalogCardId: string;
  readonly name: string;
  readonly type: BattleCardInstance["type"];
  readonly side: BattleSide;
  readonly attribute: CardAttribute;
  readonly currentCost: number;
  readonly attack?: number;
  readonly hp?: number;
  readonly maxHp?: number;
  readonly movement: number;
  readonly isToken: boolean;
  readonly effectIds: readonly string[];
  readonly position?: BoardCoordinate;
}

export interface CpuVisibleBase {
  readonly id: BattleBaseId;
  readonly coordinate: BoardCoordinate;
  readonly kind: BattleBaseKind;
  readonly owner: BattleBaseOwner;
  readonly currentHp: number;
  readonly maxHp: number;
}

export interface CpuVisibleState {
  readonly activeSide: BattleSide;
  readonly phase: BattleState["phase"];
  readonly turnNumber: number;
  readonly cpuHand: readonly CpuVisibleCard[];
  readonly cpuHandCount: number;
  readonly playerHandCount: number;
  readonly cpuDeckCount: number;
  readonly playerDeckCount: number;
  readonly cpuCurrentPp: number;
  readonly cpuMaxPp: number;
  readonly cpuResonance: ResonanceMap;
  readonly bases: readonly CpuVisibleBase[];
  readonly boardCards: readonly CpuVisibleCard[];
  readonly legalActions: readonly LegalAction[];
}

export function projectCpuVisibleState(
  state: BattleState,
  legalActions: readonly LegalAction[]
): CpuVisibleState {
  return {
    activeSide: state.activeSide,
    phase: state.phase,
    turnNumber: state.metadata.turnNumber,
    cpuHand: state.players.cpu.handZone
      .map((instanceId) => state.cardInstances[instanceId])
      .filter((card): card is BattleCardInstance => Boolean(card))
      .map((card) => toVisibleCard(card, state)),
    cpuHandCount: state.players.cpu.handZone.length,
    playerHandCount: state.players.player.handZone.length,
    cpuDeckCount: state.players.cpu.deckZone.length,
    playerDeckCount: state.players.player.deckZone.length,
    cpuCurrentPp: state.players.cpu.currentPp,
    cpuMaxPp: state.players.cpu.maxPp,
    cpuResonance: state.players.cpu.resonance,
    bases: BATTLE_BASE_IDS.map((id) => {
      const base = state.bases[id];
      return {
        id: base.id,
        coordinate: { ...base.coordinate },
        kind: base.kind,
        owner: base.owner,
        currentHp: base.currentHp,
        maxHp: base.maxHp
      };
    }),
    boardCards: Object.values(state.cardInstances)
      .filter((card) => card.zone === "board")
      .map((card) => toVisibleCard(card, state)),
    legalActions
  };
}

export function assertCpuVisibleStateIsRedacted(visible: CpuVisibleState): boolean {
  return (
    visible.playerHandCount >= 0 &&
    visible.playerDeckCount >= 0 &&
    !("playerHand" in visible) &&
    !("playerDeck" in visible) &&
    !("deckZone" in visible) &&
    !("cardInstances" in visible)
  );
}

/**
 * A forecast must not disclose the identity of a card that was still in the
 * CPU deck when the decision began.  Its hand count remains useful for
 * evaluating draw effects, while the actual card is visible only after the
 * command has genuinely resolved.
 */
export function redactCpuForecastHand(
  forecast: CpuVisibleState,
  knownHandInstanceIds: readonly string[]
): CpuVisibleState {
  const known = new Set(knownHandInstanceIds);
  return {
    ...forecast,
    cpuHand: forecast.cpuHand.filter((card) => known.has(card.instanceId))
  };
}

function toVisibleCard(card: BattleCardInstance, state: BattleState): CpuVisibleCard {
  const isCreature = card.type === "creature" || card.type === "creature-token";
  return {
    instanceId: card.instanceId,
    catalogCardId: card.catalogCardId,
    name: card.name,
    type: card.type,
    side: card.controllerSide,
    attribute: card.attribute,
    currentCost: card.currentCost,
    attack: isCreature ? getEffectiveCreatureAttack(state, card) : card.currentAttack,
    hp: isCreature ? getEffectiveCreatureCurrentHp(state, card) : card.currentHp,
    maxHp: isCreature ? getEffectiveCreatureMaxHp(state, card) : card.maxHp,
    movement: isCreature ? getEffectiveCreatureMovement(state, card) : card.movement,
    isToken: card.isToken,
    effectIds: [...card.effectIds],
    position: card.position
  };
}
