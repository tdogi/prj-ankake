import type { BattleBaseId, BattleCommand, BoardCoordinate, LegalAction } from "@ankake/domain";
import type { CpuVisibleBase, CpuVisibleCard, CpuVisibleState } from "./visibleState";

const CENTER_BASE_ID = "neutral-center";
const CENTER_APPROACH_RANGE = 5;

export type CpuStopReason =
  | "no-legal-action"
  | "no-beneficial-action"
  | "terminal"
  | "processing-limit";

export interface CpuActionScore {
  readonly action: LegalAction;
  readonly score: number;
  readonly reasons: readonly string[];
}

export type CpuDecision =
  | { readonly kind: "command"; readonly command: BattleCommand; readonly score: CpuActionScore }
  | { readonly kind: "stop"; readonly reason: CpuStopReason };

/** Selects a legal action from CPU-owned and public information only. */
export function chooseCpuAction(visible: CpuVisibleState): CpuDecision {
  if (visible.phase === "terminal") return { kind: "stop", reason: "terminal" };
  if (visible.legalActions.length === 0) return { kind: "stop", reason: "no-legal-action" };

  const selected = visible.legalActions
    .map((action) => scoreAction(action, visible))
    .filter((score) => score.score > 0)
    .sort(compareScores)[0];

  return selected
    ? { kind: "command", command: selected.action.command, score: selected }
    : { kind: "stop", reason: "no-beneficial-action" };
}

export function scoreAction(action: LegalAction, visible: CpuVisibleState): CpuActionScore {
  const reasons: string[] = [];
  let score = action.scoreHint;

  switch (action.command.type) {
    case "summonCreature":
      score += scoreSummon(action, visible, reasons);
      break;
    case "moveCreature":
      score += scoreMovement(action, visible, reasons);
      break;
    case "castSpell":
      score += scoreSpell(action, visible, reasons);
      break;
    case "endPlayPhase":
      score -= visible.legalActions.length > 1 ? 8 : 0;
      reasons.push("end-phase");
      break;
  }
  return { action, score, reasons };
}

function scoreSummon(action: LegalAction, visible: CpuVisibleState, reasons: string[]): number {
  const command = action.command;
  if (command.type !== "summonCreature") return 0;
  const card = visible.cpuHand.find((candidate) => candidate.instanceId === command.handInstanceId);
  reasons.push("develop-board");
  return 6 + creatureValue(card) + scorePosition(command.destination, card?.attack ?? action.scoreHint, visible, reasons);
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
  return after - before;
}

function scoreSpell(action: LegalAction, visible: CpuVisibleState, reasons: string[]): number {
  if (action.command.type !== "castSpell") return 0;
  const command = action.command;
  let value = 4;
  const targetIds = [...(command.targetInstanceId ? [command.targetInstanceId] : []), ...(command.effectSelection?.creatureIds ?? [])];
  const baseIds = [...(command.targetBaseId ? [command.targetBaseId] : []), ...(command.effectSelection?.baseIds ?? [])];

  for (const targetId of targetIds) {
    const target = visible.boardCards.find((card) => card.instanceId === targetId);
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
  if (targetIds.length === 0 && baseIds.length === 0 && !command.effectSelection?.coordinates?.length) reasons.push("apply-pressure");
  return value;
}

/** Scores automatic attacks enabled by a square, objectives, and exposure. */
function scorePosition(position: BoardCoordinate, attack: number, visible: CpuVisibleState, reasons: string[]): number {
  let value = progressValue(position);
  value += scoreCenterApproach(position, visible, reasons);
  const adjacentEnemies = visible.boardCards.filter((card) => card.side === "player" && card.position && isAdjacent(position, card.position));
  for (const enemy of adjacentEnemies) value += creatureValue(enemy) + attack * 2;
  if (adjacentEnemies.length) reasons.push("attack-enemy");
  for (const base of visible.bases.filter((candidate) => isAdjacent(position, candidate.coordinate))) value += scoreBaseTarget(base, visible, reasons, attack);

  // Attacks are not retaliatory, but this is still exposure on the opponent's next turn.
  const danger = adjacentEnemies.reduce((total, enemy) => total + (enemy.attack ?? 1), 0);
  value -= danger * 0.45;
  if (danger >= 5) reasons.push("avoid-exposure");
  return value;
}

function scoreBaseTarget(base: CpuVisibleBase, visible: CpuVisibleState, reasons: string[], attack = 0): number {
  if (base.id === "cpu-base" || base.owner === "cpu") return 0;
  if (base.id === "player-base") {
    const lethal = attack > 0 && base.currentHp <= attack;
    reasons.push(lethal ? "win-game" : "pressure-player-base");
    return lethal ? 1000 : 24 + (base.maxHp - base.currentHp) * 2;
  }
  const ownedNeutralCount = visible.bases.filter((candidate) => candidate.kind === "neutral-base" && candidate.owner === "cpu").length;
  const finalNeutral = ownedNeutralCount === 2;
  const capturable = attack > 0 && base.currentHp <= attack;
  reasons.push(finalNeutral && capturable ? "win-by-control" : "contest-neutral-base");
  if (finalNeutral && capturable) return 900;

  const damageProgress = (base.maxHp - base.currentHp) * 1.5;
  if (base.id !== CENTER_BASE_ID) return 16 + damageProgress;

  reasons.push(base.owner === "player" ? "reclaim-center-base" : "pressure-center-base");
  const ownershipPressure = base.owner === "player" ? 14 : 8;
  const capturePressure = capturable ? 18 : 0;
  return 30 + ownershipPressure + ownedNeutralCount * 3 + capturePressure + damageProgress;
}

/**
 * The central neutral base is the board's most valuable staging objective:
 * it has the largest health pool and grants a useful additional summon range.
 * Reward progress towards a non-CPU-owned center before a unit is adjacent,
 * so the CPU does not only notice the base after it reaches it.
 */
function scoreCenterApproach(position: BoardCoordinate, visible: CpuVisibleState, reasons: string[]): number {
  const center = getVisibleBaseById(visible.bases, CENTER_BASE_ID);
  if (center.owner === "cpu") return 0;

  const distance = chebyshevDistance(position, center.coordinate);
  const proximity = Math.max(0, CENTER_APPROACH_RANGE - distance);
  if (proximity === 0) return 0;

  reasons.push("advance-center-objective");
  const contestBonus = center.owner === "player" ? 2 : 0;
  return proximity * 4 + contestBonus;
}

function progressValue(position: BoardCoordinate): number {
  return position.row * 1.4 - Math.abs(position.column - 6) * 0.15;
}

function creatureValue(card: CpuVisibleCard | undefined): number {
  return card ? (card.attack ?? 1) * 2 + (card.hp ?? 1) * 0.7 : 1;
}

function isAdjacent(left: BoardCoordinate, right: BoardCoordinate): boolean {
  const columnDelta = Math.abs(left.column - right.column);
  const rowDelta = Math.abs(left.row - right.row);
  return columnDelta <= 1 && rowDelta <= 1 && columnDelta + rowDelta > 0;
}

function chebyshevDistance(left: BoardCoordinate, right: BoardCoordinate): number {
  return Math.max(Math.abs(left.column - right.column), Math.abs(left.row - right.row));
}

function getVisibleBaseById(bases: readonly CpuVisibleBase[], baseId: BattleBaseId): CpuVisibleBase {
  const base = bases.find((candidate) => candidate.id === baseId);
  if (!base) throw new Error(`Missing required CPU-visible battle base: ${baseId}`);
  return base;
}

function compareScores(left: CpuActionScore, right: CpuActionScore): number {
  return right.score - left.score || left.action.label.localeCompare(right.action.label, "en") || commandTieBreakKey(left.action.command).localeCompare(commandTieBreakKey(right.action.command), "en");
}

function commandTieBreakKey(command: BattleCommand): string {
  switch (command.type) {
    case "summonCreature": return `${command.type}:${command.handInstanceId}:${command.destination.column}:${command.destination.row}`;
    case "castSpell": return `${command.type}:${command.handInstanceId}:${command.targetInstanceId ?? command.targetBaseId ?? ""}`;
    case "moveCreature": return `${command.type}:${command.creatureInstanceId}:${command.path.map((step) => `${step.column}:${step.row}`).join("/")}`;
    case "endPlayPhase": return command.type;
  }
}
