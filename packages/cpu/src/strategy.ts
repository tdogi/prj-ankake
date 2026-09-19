import type { BattleBaseId, BattleCommand, BoardCoordinate, LegalAction } from "@ankake/domain";
import type { CpuVisibleBase, CpuVisibleCard, CpuVisibleState } from "./visibleState";

const SIDE_BASE_IDS = ["neutral-left", "neutral-right"] as const;
const CENTER_BASE_ID = "neutral-center";
const PLAYER_BASE_ID = "player-base";
const DRAW_CARD_IDS = new Set(["AK-015", "AK-016", "AK-017", "AK-023", "AK-026", "AK-031", "AK-034", "AK-054"]);

export type CpuStopReason = "no-legal-action" | "no-beneficial-action" | "terminal" | "processing-limit";

export interface CpuActionScore {
  readonly action: LegalAction;
  readonly score: number;
  readonly reasons: readonly string[];
}

export type CpuDecision =
  | { readonly kind: "command"; readonly command: BattleCommand; readonly score: CpuActionScore }
  | { readonly kind: "stop"; readonly reason: CpuStopReason };

/** A runtime-provided, redacted projection of a command's resolved result. */
export type CpuActionForecaster = (action: LegalAction) => CpuVisibleState | undefined;

/**
 * Selects a legal action from CPU-owned and public information only. The
 * forecast exposes only this same redacted projection after resolution, so
 * effects and order can be valued without seeing either hidden deck or hand.
 */
export function chooseCpuAction(visible: CpuVisibleState, forecast?: CpuActionForecaster): CpuDecision {
  if (visible.phase === "terminal") return { kind: "stop", reason: "terminal" };
  if (visible.legalActions.length === 0) return { kind: "stop", reason: "no-legal-action" };

  const selected = visible.legalActions
    .map((action) => scoreAction(action, visible, forecast?.(action)))
    .filter((score) => score.score > 0)
    .sort(compareScores)[0];
  return selected
    ? { kind: "command", command: selected.action.command, score: selected }
    : { kind: "stop", reason: "no-beneficial-action" };
}

export function scoreAction(action: LegalAction, visible: CpuVisibleState, after?: CpuVisibleState): CpuActionScore {
  const reasons: string[] = [];
  let score = action.scoreHint;
  switch (action.command.type) {
    case "summonCreature": score += scoreSummon(action, visible, reasons); break;
    case "moveCreature": score += scoreMovement(action, visible, reasons); break;
    case "castSpell": score += scoreSpell(action, visible, reasons); break;
    case "endPlayPhase":
      score -= visible.legalActions.length > 1 ? 8 : 0;
      reasons.push("end-phase");
      break;
  }
  if (after) score += scoreForecast(visible, after, reasons);
  return { action, score, reasons };
}

function scoreSummon(action: LegalAction, visible: CpuVisibleState, reasons: string[]): number {
  const command = action.command;
  if (command.type !== "summonCreature") return 0;
  const card = visible.cpuHand.find((candidate) => candidate.instanceId === command.handInstanceId);
  reasons.push("develop-board");
  let value = 6 + creatureValue(card) + scorePosition(command.destination, card?.attack ?? action.scoreHint, visible, reasons);
  if (isDrawCard(card) && isWeakHand(visible)) {
    value += 20;
    reasons.push("refill-weak-hand");
  }
  return value + scoreResonanceSetup(card, command.destination, visible, reasons);
}

function scoreMovement(action: LegalAction, visible: CpuVisibleState, reasons: string[]): number {
  const command = action.command;
  if (command.type !== "moveCreature") return 0;
  const creature = visible.boardCards.find((card) => card.instanceId === command.creatureInstanceId);
  const destination = command.path.at(-1);
  if (!creature || !destination) return 0;
  const before = scorePosition(command.origin, creature.attack ?? 1, visible, []);
  const after = scorePosition(destination, creature.attack ?? 1, visible, reasons);
  reasons.push(after > before ? "improve-position" : "reposition");
  return after - before + (creature.catalogCardId === "AK-022" && isWeakHand(visible) ? 16 : 0);
}

function scoreSpell(action: LegalAction, visible: CpuVisibleState, reasons: string[]): number {
  if (action.command.type !== "castSpell") return 0;
  const command = action.command;
  const card = visible.cpuHand.find((candidate) => candidate.instanceId === command.handInstanceId);
  let value = 4;
  const targetIds = [...(command.targetInstanceId ? [command.targetInstanceId] : []), ...(command.effectSelection?.creatureIds ?? [])];
  const baseIds = [...(command.targetBaseId ? [command.targetBaseId] : []), ...(command.effectSelection?.baseIds ?? [])];
  for (const targetId of targetIds) {
    const target = visible.boardCards.find((candidate) => candidate.instanceId === targetId);
    if (!target) continue;
    if (target.side === "player") {
      value += creatureValue(target) + 5;
      reasons.push("remove-threat");
    } else {
      value += Math.max(2, creatureValue(target) / 2);
      reasons.push("support-ally");
    }
  }
  for (const baseId of baseIds) value += scoreBaseTarget(getVisibleBaseById(visible.bases, baseId), visible, reasons);
  if (command.effectSelection?.coordinates?.length) {
    value += command.effectSelection.coordinates.length * 2;
    reasons.push("board-effect");
  }
  if (isDrawCard(card) && isWeakHand(visible)) {
    value += 22;
    reasons.push("refill-weak-hand");
  }
  if (targetIds.length === 0 && baseIds.length === 0 && !command.effectSelection?.coordinates?.length) reasons.push("apply-pressure");
  return value;
}

function scorePosition(position: BoardCoordinate, attack: number, visible: CpuVisibleState, reasons: string[]): number {
  let value = progressValue(position) + scoreObjectiveApproach(position, visible, reasons);
  const adjacentEnemies = visible.boardCards.filter((card) => card.side === "player" && card.position && isAdjacent(position, card.position));
  for (const enemy of adjacentEnemies) value += creatureValue(enemy) + attack * 2;
  if (adjacentEnemies.length) reasons.push("attack-enemy");
  for (const base of visible.bases.filter((candidate) => isAdjacent(position, candidate.coordinate))) value += scoreBaseTarget(base, visible, reasons, attack);
  const danger = adjacentEnemies.reduce((total, enemy) => total + (enemy.attack ?? 1), 0);
  value -= danger * 0.45;
  if (danger >= 5) reasons.push("avoid-exposure");
  return value;
}

function scoreBaseTarget(base: CpuVisibleBase, visible: CpuVisibleState, reasons: string[], attack = 0): number {
  if (base.id === "cpu-base" || base.owner === "cpu") return 0;
  if (base.id === PLAYER_BASE_ID) {
    const lethal = attack > 0 && base.currentHp <= attack;
    reasons.push(lethal ? "win-game" : "pressure-player-base");
    return lethal ? 1000 : 24 + (base.maxHp - base.currentHp) * 2 + (hasSideBase(visible) ? 12 : 0);
  }
  const ownedNeutralCount = ownedNeutralBases(visible).length;
  const capturable = attack > 0 && base.currentHp <= attack;
  if (ownedNeutralCount === 2 && capturable) {
    reasons.push("win-by-control");
    return 900;
  }
  const damageProgress = (base.maxHp - base.currentHp) * 1.5;
  if (base.id === CENTER_BASE_ID) {
    reasons.push(base.owner === "player" ? "reclaim-center-base" : "pressure-center-base");
    return (hasSideBase(visible) ? 42 : 8) + (base.owner === "player" ? 14 : 0) + (capturable ? 18 : 0) + damageProgress;
  }
  reasons.push(base.owner === "player" ? "reclaim-side-base" : "contest-side-base");
  return (hasSideBase(visible) ? 18 : 32) + (base.owner === "player" ? 10 : 0) + (capturable ? 16 : 0) + damageProgress;
}

/** Opening targets a side base. Once one is owned, the center and enemy base lead the objective list. */
function scoreObjectiveApproach(position: BoardCoordinate, visible: CpuVisibleState, reasons: string[]): number {
  const nearest = objectiveBases(visible)
    .map((base) => ({ base, distance: chebyshevDistance(position, base.coordinate) }))
    .sort((left, right) => left.distance - right.distance || objectiveTieBreak(left.base, right.base))[0];
  if (!nearest) return 0;
  const proximity = Math.max(0, 7 - nearest.distance);
  if (proximity === 0) return 0;
  reasons.push(nearest.base.id === CENTER_BASE_ID ? "advance-center-objective" : nearest.base.id === PLAYER_BASE_ID ? "advance-player-base" : "advance-side-objective");
  return proximity * (nearest.base.id === CENTER_BASE_ID ? 3 : 4);
}

function objectiveBases(visible: CpuVisibleState): readonly CpuVisibleBase[] {
  const sides = SIDE_BASE_IDS.map((id) => getVisibleBaseById(visible.bases, id));
  if (!hasSideBase(visible)) {
    return [sides.slice().sort((left, right) => openingSideValue(right, visible) - openingSideValue(left, visible) || objectiveTieBreak(left, right))[0]!];
  }
  return [getVisibleBaseById(visible.bases, CENTER_BASE_ID), getVisibleBaseById(visible.bases, PLAYER_BASE_ID), ...sides.filter((base) => base.owner !== "cpu")];
}

function openingSideValue(base: CpuVisibleBase, visible: CpuVisibleState): number {
  const nearestCpu = visible.boardCards.filter((card) => card.side === "cpu" && card.position)
    .map((card) => chebyshevDistance(card.position!, base.coordinate)).sort((left, right) => left - right)[0] ?? 8;
  return (base.maxHp - base.currentHp) * 3 + (base.owner === "player" ? 6 : 0) - nearestCpu * 1.5;
}

function scoreForecast(before: CpuVisibleState, after: CpuVisibleState, reasons: string[]): number {
  let value = 0;
  const beforeThreat = defensiveThreat(before);
  const afterThreat = defensiveThreat(after);
  if (beforeThreat.total > 0) {
    const reduced = beforeThreat.total - afterThreat.total;
    if (reduced > 0) {
      value += reduced * 34;
      reasons.push("defend-owned-base");
    }
    if (beforeThreat.immediateLoss && !afterThreat.immediateLoss) {
      value += 400;
      reasons.push("prevent-immediate-loss");
    } else if (beforeThreat.immediateLoss && afterThreat.immediateLoss) value -= 180;
  }
  const beforeProfile = attackProfile(before);
  const afterProfile = attackProfile(after);
  const attackGain = afterProfile.enemyBaseDamage - beforeProfile.enemyBaseDamage;
  if (attackGain > 0) {
    value += attackGain * 7;
    reasons.push("maximize-board-attack");
  }
  const boardGain = afterProfile.cpuBoardValue - beforeProfile.cpuBoardValue;
  if (boardGain > 0) {
    value += boardGain * 2.5;
    reasons.push("board-synergy");
  }
  const removedEnemyValue = beforeProfile.playerBoardValue - afterProfile.playerBoardValue;
  if (removedEnemyValue > 0) {
    value += removedEnemyValue * 3;
    reasons.push("remove-threat");
  }
  if (after.cpuHandCount > before.cpuHandCount && isWeakHand(before)) {
    value += (after.cpuHandCount - before.cpuHandCount) * 14;
    reasons.push("refill-weak-hand");
  }
  for (const base of after.bases) {
    const previous = getVisibleBaseById(before.bases, base.id);
    if (previous.owner !== "cpu" && base.owner === "cpu" && base.kind === "neutral-base") {
      value += base.id === CENTER_BASE_ID ? 70 : 90;
      reasons.push("capture-objective");
    }
    if (previous.owner === "cpu" && base.currentHp > previous.currentHp) {
      value += (base.currentHp - previous.currentHp) * 6;
      reasons.push("repair-owned-base");
    }
  }
  return value;
}

function defensiveThreat(visible: CpuVisibleState): { readonly total: number; readonly immediateLoss: boolean } {
  let total = 0;
  let immediateLoss = false;
  for (const base of visible.bases.filter((candidate) => candidate.owner === "cpu")) {
    const damage = visible.boardCards.filter((card) => card.side === "player" && card.position && isAdjacent(card.position, base.coordinate))
      .reduce((sum, card) => sum + (card.attack ?? 1), 0);
    total += damage;
    immediateLoss ||= damage >= base.currentHp;
  }
  return { total, immediateLoss };
}

function attackProfile(visible: CpuVisibleState): { readonly enemyBaseDamage: number; readonly cpuBoardValue: number; readonly playerBoardValue: number } {
  const cpuCards = visible.boardCards.filter((card) => card.side === "cpu" && card.position);
  const enemyBaseDamage = cpuCards.reduce((total, card) => total + visible.bases
    .filter((base) => base.owner !== "cpu" && isAdjacent(card.position!, base.coordinate))
    .reduce((damage) => damage + (card.attack ?? 1), 0), 0);
  return {
    enemyBaseDamage,
    cpuBoardValue: cpuCards.reduce((total, card) => total + creatureValue(card), 0),
    playerBoardValue: visible.boardCards.filter((card) => card.side === "player").reduce((total, card) => total + creatureValue(card), 0)
  };
}

function scoreResonanceSetup(card: CpuVisibleCard | undefined, destination: BoardCoordinate, visible: CpuVisibleState, reasons: string[]): number {
  if (!card) return 0;
  const lane = destination.column <= 4 ? "left" : destination.column >= 8 ? "right" : "center";
  if (visible.cpuResonance[lane][card.attribute] + card.currentCost < 15) return 0;
  reasons.push("activate-resonance");
  return 12;
}

function isWeakHand(visible: CpuVisibleState): boolean {
  const attack = (side: "cpu" | "player") => visible.boardCards.filter((card) => card.side === side).reduce((total, card) => total + (card.attack ?? 0), 0);
  return visible.cpuDeckCount > 0 && visible.cpuHandCount <= 2 && attack("cpu") <= attack("player") + 2;
}
function isDrawCard(card: CpuVisibleCard | undefined): boolean { return Boolean(card && DRAW_CARD_IDS.has(card.catalogCardId)); }
function ownedNeutralBases(visible: CpuVisibleState): readonly CpuVisibleBase[] { return visible.bases.filter((candidate) => candidate.kind === "neutral-base" && candidate.owner === "cpu"); }
function hasSideBase(visible: CpuVisibleState): boolean { return SIDE_BASE_IDS.some((id) => getVisibleBaseById(visible.bases, id).owner === "cpu"); }
function progressValue(position: BoardCoordinate): number { return position.row * 1.4 - Math.abs(position.column - 6) * 0.15; }
function creatureValue(card: CpuVisibleCard | undefined): number { return card ? (card.attack ?? 1) * 2 + (card.hp ?? 1) * 0.7 : 1; }
function isAdjacent(left: BoardCoordinate, right: BoardCoordinate): boolean { const columnDelta = Math.abs(left.column - right.column); const rowDelta = Math.abs(left.row - right.row); return columnDelta <= 1 && rowDelta <= 1 && columnDelta + rowDelta > 0; }
function chebyshevDistance(left: BoardCoordinate, right: BoardCoordinate): number { return Math.max(Math.abs(left.column - right.column), Math.abs(left.row - right.row)); }
function getVisibleBaseById(bases: readonly CpuVisibleBase[], baseId: BattleBaseId): CpuVisibleBase { const base = bases.find((candidate) => candidate.id === baseId); if (!base) throw new Error(`Missing required CPU-visible battle base: ${baseId}`); return base; }
function objectiveTieBreak(left: CpuVisibleBase, right: CpuVisibleBase): number { return left.id.localeCompare(right.id, "en"); }
function compareScores(left: CpuActionScore, right: CpuActionScore): number { return right.score - left.score || left.action.label.localeCompare(right.action.label, "en") || commandTieBreakKey(left.action.command).localeCompare(commandTieBreakKey(right.action.command), "en"); }
function commandTieBreakKey(command: BattleCommand): string {
  switch (command.type) {
    case "summonCreature": return `${command.type}:${command.handInstanceId}:${command.destination.column}:${command.destination.row}`;
    case "castSpell": return `${command.type}:${command.handInstanceId}:${command.targetInstanceId ?? command.targetBaseId ?? ""}`;
    case "moveCreature": return `${command.type}:${command.creatureInstanceId}:${command.path.map((step) => `${step.column}:${step.row}`).join("/")}`;
    case "endPlayPhase": return command.type;
  }
}
