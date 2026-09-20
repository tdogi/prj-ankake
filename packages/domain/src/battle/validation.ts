import { validateMovementPath } from "./movement";
import { getLane } from "./board";
import { getCreaturePlayCost } from "./resonance";
import { validateSummonDestination, validateSummonSource } from "./summon";
import { getExecutablePlayEffects, hasTargetedSummonEffect } from "./effectPrograms";
import { getLegalEffectTargets } from "./effectResolver";
import { isCardEffectScriptSupported } from "./cardEffectRuntime";
import type {
  BattleCardInstance,
  BattleCommand,
  BattleState,
  BattleValidationIssue
} from "./types";

export function validateBattleCommand(
  state: BattleState,
  command: BattleCommand
): readonly BattleValidationIssue[] {
  if (command.type === "resign") {
    return validateResignation(state);
  }

  const commonIssues = validateCommon(state, command);
  if (commonIssues.length > 0) {
    return commonIssues;
  }

  switch (command.type) {
    case "summonCreature":
      return validateSummon(state, command);
    case "castSpell":
      return validateSpell(state, command);
    case "moveCreature":
      return validateMove(state, command);
    case "endPlayPhase":
      return [];
  }
}

function validateResignation(state: BattleState): readonly BattleValidationIssue[] {
  if (state.phase === "terminal" || state.terminalResult) {
    return [
      {
        code: "battle.terminal",
        message: "The battle has already ended."
      }
    ];
  }

  return [];
}

export function getFirstValidationMessage(issues: readonly BattleValidationIssue[]): string {
  return issues[0]?.message ?? "Command is not legal.";
}

function validateCommon(
  state: BattleState,
  command: BattleCommand
): readonly BattleValidationIssue[] {
  if (state.phase === "terminal" || state.terminalResult) {
    return [
      {
        code: "battle.terminal",
        message: "The battle has already ended."
      }
    ];
  }

  if (state.phase !== "play") {
    return [
      {
        code: "battle.phase.invalid",
        message: "Battle commands can be confirmed only during a play phase."
      }
    ];
  }

  if (state.activeSide !== command.side) {
    return [
      {
        code: "battle.side.inactive",
        message: "It is not this side's turn."
      }
    ];
  }

  return [];
}

function validateSummon(
  state: BattleState,
  command: Extract<BattleCommand, { type: "summonCreature" }>
): readonly BattleValidationIssue[] {
  const sourceIssues = validateSummonSource(state, command.side, command.handInstanceId);
  if (sourceIssues.length > 0) {
    return sourceIssues;
  }

  const destinationIssues = validateSummonDestination(state, command.side, command.destination);
  if (destinationIssues.length > 0) return destinationIssues;
  const card = state.cardInstances[command.handInstanceId] as BattleCardInstance;
  const cost = getCreaturePlayCost(state, command.side, card, getLane(command.destination.column));
  if (cost > state.players[command.side].currentPp) return [{
    code: "battle.resource.pp-insufficient",
    message: "Not enough PP to play this creature.",
    path: "currentPp"
  }];
  // A summon still succeeds when its optional-at-resolution target set is
  // empty.  The effect resolver then has no selection to apply, while spells
  // keep their stricter target requirement in validateSpell.
  if (requiresSummonEffectSelection(card) && !command.effectSelection) return [];
  const counts: Readonly<Record<string, number>> = { "AK-038": 1, "AK-042": 1, "AK-046": 2, "AK-048": 3, "AK-057": 1 };
  const count = counts[card.catalogCardId];
  if (count) {
    const selection = command.effectSelection; const coordinates = selection?.coordinates ?? [];
    const validCell = (coordinate: { column: number; row: number }) => {
      const square = state.board.squares.find((candidate) => candidate.coordinate.column === coordinate.column && candidate.coordinate.row === coordinate.row);
      if (!square || square.terrain !== "normal" || square.occupantId || (coordinate.column === command.destination.column && coordinate.row === command.destination.row)) return false;
      return card.catalogCardId === "AK-038" || card.catalogCardId === "AK-057"
        ? Math.abs(coordinate.column - command.destination.column) <= 1 && Math.abs(coordinate.row - command.destination.row) <= 1
        : square.lane === getLane(command.destination.column);
    };
    const graveyardTarget = selection?.graveyardCardIds?.[0];
    const graveyardCard = graveyardTarget ? state.cardInstances[graveyardTarget] : undefined;
    const graveyardOk = card.catalogCardId !== "AK-057" || Boolean(selection?.graveyardCardIds?.length === 1 && graveyardTarget && state.players[command.side].graveyardZone.includes(graveyardTarget) && graveyardCard && (graveyardCard.type === "creature" || graveyardCard.type === "creature-token") && graveyardCard.cost <= 3);
    if (!(coordinates.length === count && new Set(coordinates.map((coordinate) => `${coordinate.column}:${coordinate.row}`)).size === count && coordinates.every(validCell) && graveyardOk)) {
      return invalidSelection("Select the required legal effect targets before summoning.");
    }
  }
  return validateSummonEffectSelection(state, command.side, card, command.effectSelection, command.destination) ?? [];
}

function requiresSummonEffectSelection(card: BattleCardInstance): boolean {
  const operation = getExecutablePlayEffects(card)[0]?.operations[0];
  if (operation && operation.minimumTargets > 0) return true;
  return hasTargetedSummonEffect(card);
}

function validateSpell(
  state: BattleState,
  command: Extract<BattleCommand, { type: "castSpell" }>
): readonly BattleValidationIssue[] {
  const card = state.cardInstances[command.handInstanceId];
  const issues = validateHandCard(state, command.side, card, "spell");

  if (issues.length > 0) {
    return issues;
  }

  const player = state.players[command.side];

  if ((card as BattleCardInstance).currentCost > player.currentPp) {
    return [
      {
        code: "battle.resource.pp-insufficient",
        message: "Not enough PP to cast this spell.",
        path: "currentPp"
      }
    ];
  }

  const effect = getExecutablePlayEffects(card as BattleCardInstance)[0];
  if (!effect) return [];
  const operation = effect.operations[0];
  if (operation?.kind === "card-script") {
    if (!isCardEffectScriptSupported((card as BattleCardInstance).catalogCardId)) {
      return [{ code: "battle.effect.unsupported", message: "This card effect has no executable program.", path: "effectSelection" }];
    }
    return validateScriptedSpellSelection(state, command, card as BattleCardInstance);
  }
  const structuredTargets = command.effectSelection
    ? [
      ...(command.effectSelection.creatureIds ?? []).map((instanceId) => ({ kind: "creature" as const, instanceId })),
      ...(command.effectSelection.baseIds ?? []).map((baseId) => ({ kind: "base" as const, baseId }))
    ]
    : [];
  const selected = command.effectSelection
    ? structuredTargets.length === 1 ? structuredTargets[0] : undefined
    : command.targetInstanceId
      ? { kind: "creature" as const, instanceId: command.targetInstanceId }
      : command.targetBaseId
        ? { kind: "base" as const, baseId: command.targetBaseId }
        : undefined;
  if (!selected) return [{ code: "battle.effect.no-target", message: "This spell requires a legal target.", path: "target" }];
  const legal = operation ? getLegalEffectTargets(state, command.side, operation) : [];
  const isLegal = legal.some((target) => {
    if (target.kind !== selected.kind) return false;
    return target.kind === "creature" && selected.kind === "creature"
      ? target.instanceId === selected.instanceId
      : target.kind === "base" && selected.kind === "base"
        ? target.baseId === selected.baseId
        : false;
  });
  return isLegal ? [] : [{ code: "battle.effect.no-target", message: "The selected spell target is no longer legal.", path: "target" }];
}

function validateScriptedSpellSelection(
  state: BattleState,
  command: Extract<BattleCommand, { type: "castSpell" }>,
  card: BattleCardInstance
): readonly BattleValidationIssue[] {
  const selection = command.effectSelection;
  const ids = selection?.graveyardCardIds ?? [];
  const coordinates = selection?.coordinates ?? [];
  const player = state.players[command.side];
  const uniqueCoordinates = new Set(coordinates.map((coordinate) => `${coordinate.column}:${coordinate.row}`));
  const emptyNormal = (coordinate: { column: number; row: number }) => state.board.squares.some((square) => square.coordinate.column === coordinate.column && square.coordinate.row === coordinate.row && square.terrain === "normal" && !square.occupantId);
  if (card.catalogCardId === "AK-008" || card.catalogCardId === "AK-011") return selection?.lane ? [] : invalidSelection("Select one lane.");
  if (card.catalogCardId === "AK-019") {
    const creature = selection?.creatureIds?.[0]; const source = creature ? state.cardInstances[creature] : undefined;
    return source?.position && coordinates.length === 1 && emptyNormal(coordinates[0]!) && getLane(source.position.column) === getLane(coordinates[0]!.column) ? [] : invalidSelection("Select a creature and an empty cell in its lane.");
  }
  if (card.catalogCardId === "AK-044") {
    const lane = selection?.lane;
    return lane && coordinates.length === 3 && uniqueCoordinates.size === 3 && coordinates.every((coordinate) => emptyNormal(coordinate) && getLane(coordinate.column) === lane) ? [] : invalidSelection("Select one lane and three empty cells in that lane.");
  }
  if (card.catalogCardId === "AK-054") {
    return ids.length === 2 && new Set(ids).size === 2 && ids.every((id) => { const target = state.cardInstances[id]; return Boolean(target && player.graveyardZone.includes(id) && (target.type === "creature" || target.type === "creature-token")); }) ? [] : invalidSelection("Select two creature cards from your graveyard.");
  }
  if (card.catalogCardId !== "AK-059") return validateSummonEffectSelection(state, command.side, card, selection) ?? [];
  const valid = ids.length === 2 && new Set(ids).size === 2 && coordinates.length === 2 && uniqueCoordinates.size === 2 &&
    ids.every((id) => {
      const target = state.cardInstances[id];
      return Boolean(target && player.graveyardZone.includes(id) && (target.type === "creature" || target.type === "creature-token") && target.cost <= 5);
    }) && coordinates.every((coordinate) => validateSummonDestination(state, command.side, coordinate).length === 0);
  return valid ? [] : invalidSelection("Resurrection Gate requires two eligible graveyard creatures and two empty summon squares.");
}

/** Validation shared by creature summon effects and scripted spells. */
function validateSummonEffectSelection(
  state: BattleState,
  side: "player" | "cpu",
  card: BattleCardInstance,
  selection: import("./types").BattleEffectSelection | undefined,
  summonDestination?: { readonly column: number; readonly row: number }
): readonly BattleValidationIssue[] | undefined {
  const operation = getExecutablePlayEffects(card)[0]?.operations[0];
  if (operation && operation.kind !== "card-script") {
    const creatureIds = selection?.creatureIds ?? [];
    const baseIds = selection?.baseIds ?? [];
    const selected = [...creatureIds.map((instanceId) => ({ kind: "creature" as const, instanceId })), ...baseIds.map((baseId) => ({ kind: "base" as const, baseId }))];
    const legal = getLegalEffectTargets(state, side, operation);
    const valid = selected.length >= operation.minimumTargets && selected.length <= operation.maximumTargets && selected.every((target) => legal.some((candidate) => candidate.kind === target.kind && (target.kind === "creature" ? candidate.kind === "creature" && candidate.instanceId === target.instanceId : candidate.kind === "base" && candidate.baseId === target.baseId)));
    return valid ? [] : invalidSelection("Select the required legal effect target.");
  }

  const relation = ["AK-006", "AK-018", "AK-052", "AK-015", "AK-039", "AK-050"].includes(card.catalogCardId)
    ? "ally"
    : ["AK-020", "AK-041", "AK-055"].includes(card.catalogCardId)
      ? "enemy"
      : undefined;
  if (!relation) return undefined;
  const selectedId = selection?.creatureIds?.[0];
  const target = selectedId ? state.cardInstances[selectedId] : undefined;
  const validCreature = Boolean(
    selectedId && selection?.creatureIds?.length === 1 && target?.zone === "board" &&
    (relation === "ally" ? target.controllerSide === side : target.controllerSide !== side) &&
    (!["AK-006", "AK-018", "AK-052"].includes(card.catalogCardId) || target.instanceId !== card.instanceId) &&
    (card.catalogCardId !== "AK-020" || Boolean(summonDestination && target.position && getLane(target.position.column) === getLane(summonDestination.column)))
  );
  if (!validCreature) return invalidSelection("Select the required legal effect target.");
  if (card.catalogCardId !== "AK-018") return [];
  const coordinate = selection?.coordinates?.[0];
  const square = coordinate && state.board.squares.find((candidate) => candidate.coordinate.column === coordinate.column && candidate.coordinate.row === coordinate.row);
  const validDestination = Boolean(coordinate && selection?.coordinates?.length === 1 && square?.terrain === "normal" && !square.occupantId && target?.position && Math.abs(coordinate.column - target.position.column) <= 1 && Math.abs(coordinate.row - target.position.row) <= 1 && !(coordinate.column === target.position.column && coordinate.row === target.position.row) && !(summonDestination && coordinate.column === summonDestination.column && coordinate.row === summonDestination.row));
  return validDestination ? [] : invalidSelection("Select an empty square adjacent to the selected creature.");
}

function invalidSelection(message: string): readonly BattleValidationIssue[] { return [{ code: "battle.effect.no-target", message, path: "effectSelection" }]; }

function validateMove(
  state: BattleState,
  command: Extract<BattleCommand, { type: "moveCreature" }>
): readonly BattleValidationIssue[] {
  return validateMovementPath(
    state,
    command.side,
    command.creatureInstanceId,
    command.origin,
    command.path
  );
}

function validateHandCard(
  state: BattleState,
  side: "player" | "cpu",
  card: BattleCardInstance | undefined,
  requiredType: "creature" | "spell"
): readonly BattleValidationIssue[] {
  if (!card) {
    return [
      {
        code: "battle.card.not-found",
        message: "The selected card no longer exists.",
        path: "handInstanceId"
      }
    ];
  }

  if (card.ownerSide !== side || !state.players[side].handZone.includes(card.instanceId)) {
    return [
      {
        code: "battle.card.owner-invalid",
        message: "The selected card is not in this side's hand.",
        path: "handInstanceId"
      }
    ];
  }

  if (card.zone !== "hand") {
    return [
      {
        code: "battle.card.zone-invalid",
        message: "The selected card is not in hand.",
        path: "handInstanceId"
      }
    ];
  }

  if (card.type !== requiredType) {
    return [
      {
        code: "battle.card.type-invalid",
        message: requiredType === "creature" ? "Only creature cards can be summoned." : "Only spell cards can be cast.",
        path: "handInstanceId"
      }
    ];
  }

  return [];
}
