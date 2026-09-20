import type {
  CardAttribute,
  CardMasterRecord,
  StaticCatalogSnapshot,
  TokenMasterRecord
} from "../catalog/types";
import type { DeckId, SavedDeck } from "../deck/types";

export type BattleSide = "player" | "cpu";
export type BattlePhase = "play" | "automatic" | "terminal";
export type BattleZone = "deck" | "hand" | "board" | "graveyard";
export type FirstPlayerMode = "random" | "player-first" | "player-second";
export type BattleCardInstanceId = string;
export type BattleId = string;

export interface BoardCoordinate {
  readonly column: number;
  readonly row: number;
}

export type BattleBaseId =
  | "cpu-base"
  | "neutral-left"
  | "neutral-center"
  | "neutral-right"
  | "player-base";

export type BattleBaseKind = "player-base" | "neutral-base";
export type BattleBaseOwner = BattleSide | "none";

export interface BattleBaseState {
  readonly id: BattleBaseId;
  readonly coordinate: BoardCoordinate;
  readonly kind: BattleBaseKind;
  readonly owner: BattleBaseOwner;
  readonly currentHp: number;
  readonly maxHp: number;
}

export type BattleBaseStateMap = Readonly<Record<BattleBaseId, BattleBaseState>>;

export type BoardTerrain = "normal" | "player-base" | "cpu-base" | "neutral-base";

export interface BoardSquare {
  readonly coordinate: BoardCoordinate;
  readonly lane: BattleLane;
  readonly terrain: BoardTerrain;
  readonly occupantId?: BattleCardInstanceId;
}

export type BattleLane = "left" | "center" | "right";

export interface BattleBoard {
  readonly squares: readonly BoardSquare[];
}

export interface BattleDeckSnapshot {
  readonly sourceDeckId: DeckId;
  readonly sourceDeckName: string;
  readonly cards: readonly string[];
  readonly capturedAt: string;
}

export interface BattleRngState {
  readonly seed: number;
  readonly position: number;
}

export interface BattleMetadata {
  readonly battleId: BattleId;
  readonly setup: BattleSetupConfig;
  readonly startedAt: string;
  readonly firstPlayer: BattleSide;
  readonly turnNumber: number;
  readonly elapsedSeconds: number;
  readonly rng: BattleRngState;
}

export interface BattleSetupConfig {
  readonly playerDeckId: DeckId;
  readonly cpuDeckId: DeckId;
  readonly firstPlayerMode: FirstPlayerMode;
  readonly seed: string;
}

export type ResonanceMap = Readonly<Record<BattleLane, Readonly<Record<CardAttribute, number>>>>;

export type ResonanceLaneUsage = Readonly<Record<BattleLane, boolean>>;

export interface ResonanceTurnUsage {
  readonly water: ResonanceLaneUsage;
  readonly wind: ResonanceLaneUsage;
  readonly dark: ResonanceLaneUsage;
}

export interface PlayerBattleState {
  readonly side: BattleSide;
  readonly deckSnapshot: BattleDeckSnapshot;
  readonly deckZone: readonly BattleCardInstanceId[];
  readonly handZone: readonly BattleCardInstanceId[];
  readonly graveyardZone: readonly BattleCardInstanceId[];
  readonly currentPp: number;
  readonly maxPp: number;
  readonly resonance: ResonanceMap;
  readonly resonanceUsage: ResonanceTurnUsage;
  readonly turnsStarted: number;
}

export interface BattleCardInstance {
  readonly instanceId: BattleCardInstanceId;
  readonly catalogCardId: string;
  readonly ownerSide: BattleSide;
  readonly controllerSide: BattleSide;
  readonly zone: BattleZone;
  readonly name: string;
  readonly type: CardMasterRecord["type"] | TokenMasterRecord["type"];
  readonly attribute: CardAttribute;
  readonly cost: number;
  readonly currentCost: number;
  readonly attack?: number;
  readonly currentAttack?: number;
  readonly health?: number;
  readonly currentHp?: number;
  readonly maxHp?: number;
  readonly movement: number;
  readonly temporaryMovementBonus?: number;
  /** A turn-bounded movement lock (for example AK-023). */
  readonly movementOverride?: number;
  readonly movementOverrideExpiresOnSide?: BattleSide;
  /** Card-effect state.  These values are intentionally instance-local so a
   * returned or resurrected card does not retain board-only effects. */
  readonly temporaryAttackBonus?: number;
  readonly temporaryHealthBonus?: number;
  readonly effectsDisabled?: boolean;
  readonly effectUsesThisTurn?: readonly string[];
  readonly isToken: boolean;
  readonly effectText: string;
  readonly effectIds: readonly string[];
  readonly position?: BoardCoordinate;
  readonly boardEntrySequence?: number;
  readonly summonedThisTurn: boolean;
  readonly movedThisTurn: boolean;
}

export type BattleTerminalReason =
  | "base-destroyed"
  | "neutral-bases-controlled"
  | "deck-out"
  | "quit";

export interface BattleTerminalResult {
  readonly winner: BattleSide;
  readonly loser: BattleSide;
  readonly reason: BattleTerminalReason;
  readonly turnNumber: number;
  readonly elapsedSeconds: number;
  readonly finalEventSequence: number;
}

export interface BattleState {
  readonly battleId: BattleId;
  readonly phase: BattlePhase;
  readonly activeSide: BattleSide;
  readonly board: BattleBoard;
  readonly bases: BattleBaseStateMap;
  readonly players: Readonly<Record<BattleSide, PlayerBattleState>>;
  readonly cardInstances: Readonly<Record<BattleCardInstanceId, BattleCardInstance>>;
  readonly metadata: BattleMetadata;
  readonly eventCursor: number;
  readonly terminalResult?: BattleTerminalResult;
}

/**
 * The complete input surface required by documented card effects.  Existing
 * single-target spell fields remain supported for backwards compatibility;
 * clients use this value for lane, square, graveyard and multi-target cards.
 */
export interface BattleEffectSelection {
  readonly creatureIds?: readonly BattleCardInstanceId[];
  readonly baseIds?: readonly BattleBaseId[];
  readonly lane?: BattleLane;
  readonly coordinates?: readonly BoardCoordinate[];
  readonly graveyardCardIds?: readonly BattleCardInstanceId[];
}

export type AttackTarget =
  | {
      readonly kind: "creature";
      readonly instanceId: BattleCardInstanceId;
    }
  | {
      readonly kind: "base";
      readonly baseId: BattleBaseId;
    };

export interface AttackTargetSnapshot {
  readonly attackerId: BattleCardInstanceId;
  readonly targets: readonly AttackTarget[];
}

export type AttackTargetSkipReason =
  | "target-missing"
  | "target-left-board"
  | "target-no-longer-enemy"
  | "target-out-of-range"
  | "attacker-unavailable";

export type AttackTargetValidation =
  | {
      readonly valid: true;
      readonly attacker: BattleCardInstance;
      readonly target: BattleCardInstance | BattleBaseState;
    }
  | {
      readonly valid: false;
      readonly reason: AttackTargetSkipReason;
    };

export interface BattleRuleResolution {
  readonly state: BattleState;
  readonly events: readonly BattleEvent[];
  readonly nextSequence: number;
}

export type BattleTerminalTrigger =
  | {
      readonly kind: "player-base-damaged";
      readonly attackingSide: BattleSide;
      readonly baseId: BattleBaseId;
    }
  | {
      readonly kind: "neutral-base-captured";
      readonly capturingSide: BattleSide;
      readonly baseId: BattleBaseId;
    }
  | {
      readonly kind: "draw-failed";
      readonly losingSide: BattleSide;
    }
  | {
      readonly kind: "quit";
      readonly losingSide: BattleSide;
    };

export interface BattleEvent {
  readonly sequence: number;
  readonly type: BattleEventType;
  readonly message: string;
  readonly side?: BattleSide;
  readonly instanceId?: BattleCardInstanceId;
  readonly data?: Readonly<Record<string, string | number | boolean>>;
}

export type BattleEventType =
  | "battle.started"
  | "first-player.decided"
  | "card.drawn"
  | "card.overflowed"
  | "card.played"
  | "creature.summoned"
  | "creature.moved"
  | "spell.resolved"
  | "effect.fizzled"
  | "effect.partially-resolved"
  | "resonance.changed"
  | "resonance.effect-resolved"
  | "phase.ended"
  | "standby.resolved"
  | "attack.phase-started"
  | "attack.attacker-started"
  | "attack.attacker-skipped"
  | "attack.targeted"
  | "attack.target-skipped"
  | "creature.damaged"
  | "creature.destroyed"
  | "base.damaged"
  | "base.captured"
  | "attack.phase-ended"
  | "deck-out.occurred"
  | "cpu.processing-limit-reached"
  | "battle.ended";

export type BattleValidationIssueCode =
  | "battle.terminal"
  | "battle.phase.invalid"
  | "battle.side.inactive"
  | "battle.card.not-found"
  | "battle.card.zone-invalid"
  | "battle.card.owner-invalid"
  | "battle.card.type-invalid"
  | "battle.resource.pp-insufficient"
  | "battle.board.coordinate-invalid"
  | "battle.board.occupied"
  | "battle.board.destination-invalid"
  | "battle.summon.no-destination"
  | "battle.move.path-invalid"
  | "battle.move.too-far"
  | "battle.move.already-moved"
  | "battle.move.no-destination"
  | "battle.move.origin-changed"
  | "battle.resonance.inactive"
  | "battle.resonance.already-used"
  | "battle.effect.no-target"
  | "battle.effect.unsupported"
  | "battle.effect.trigger-loop";

export interface BattleValidationIssue {
  readonly code: BattleValidationIssueCode;
  readonly message: string;
  readonly path?: string;
}

export type SummonStartResult =
  | {
      readonly eligible: true;
      readonly handInstanceId: BattleCardInstanceId;
      readonly candidateDestinations: readonly BoardCoordinate[];
      readonly issues: readonly [];
    }
  | {
      readonly eligible: false;
      readonly handInstanceId: BattleCardInstanceId;
      readonly candidateDestinations: readonly [];
      readonly issues: readonly BattleValidationIssue[];
    };

export type MovementStartResult =
  | {
      readonly eligible: true;
      readonly creatureInstanceId: BattleCardInstanceId;
      readonly origin: BoardCoordinate;
      readonly maximumMovement: number;
      readonly candidateNextSteps: readonly BoardCoordinate[];
      readonly issues: readonly [];
    }
  | {
      readonly eligible: false;
      readonly creatureInstanceId: BattleCardInstanceId;
      readonly candidateNextSteps: readonly [];
      readonly issues: readonly BattleValidationIssue[];
    };

export interface MovementDraftEvaluation {
  readonly sourceEligible: boolean;
  readonly creatureInstanceId: BattleCardInstanceId;
  readonly expectedOrigin: BoardCoordinate;
  readonly validPath: readonly BoardCoordinate[];
  readonly provisionalPosition: BoardCoordinate;
  readonly usedMovement: number;
  readonly maximumMovement: number;
  readonly candidateNextSteps: readonly BoardCoordinate[];
  readonly issues: readonly BattleValidationIssue[];
}

export type BattleCommand =
  | {
      readonly type: "summonCreature";
      readonly side: BattleSide;
      readonly handInstanceId: BattleCardInstanceId;
      readonly destination: BoardCoordinate;
      readonly effectSelection?: BattleEffectSelection;
    }
  | {
      readonly type: "castSpell";
      readonly side: BattleSide;
      readonly handInstanceId: BattleCardInstanceId;
      readonly targetInstanceId?: BattleCardInstanceId;
      readonly targetBaseId?: BattleBaseId;
      readonly effectSelection?: BattleEffectSelection;
    }
  | {
      readonly type: "moveCreature";
      readonly side: BattleSide;
      readonly creatureInstanceId: BattleCardInstanceId;
      readonly origin: BoardCoordinate;
      readonly path: readonly BoardCoordinate[];
    }
  | {
      readonly type: "endPlayPhase";
      readonly side: BattleSide;
      readonly reason: "manual" | "timer" | "cpu";
    }
  | {
      readonly type: "resign";
      readonly side: BattleSide;
    };

export type BattleCommandResult =
  | {
      readonly ok: true;
      readonly state: BattleState;
      readonly events: readonly BattleEvent[];
      readonly effect?: {
        readonly status: "resolved" | "fizzled";
        readonly completedOperationCount: number;
        readonly failedOperation?: { readonly operationIndex: number; readonly reason: "target-count" | "target-invalid" | "operation-invalid" };
      };
    }
  | {
      readonly ok: false;
      readonly state: BattleState;
      readonly issues: readonly BattleValidationIssue[];
    };

export interface BattleSetupInput {
  readonly playerDeck: SavedDeck;
  readonly cpuDeck: SavedDeck;
  readonly firstPlayerMode: FirstPlayerMode;
  readonly catalog: StaticCatalogSnapshot;
  readonly seed?: string;
  readonly now: string;
}

export type BattleSetupIssueCode =
  | "battle-setup.player-deck-invalid"
  | "battle-setup.cpu-deck-invalid"
  | "battle-setup.card-missing";

export interface BattleSetupIssue {
  readonly code: BattleSetupIssueCode;
  readonly message: string;
  readonly deckId?: DeckId;
  readonly cardId?: string;
}

export type BattleSetupResult =
  | {
      readonly ok: true;
      readonly state: BattleState;
      readonly events: readonly BattleEvent[];
    }
  | {
      readonly ok: false;
      readonly issues: readonly BattleSetupIssue[];
    };

export interface LegalAction {
  readonly command: BattleCommand;
  readonly label: string;
  readonly scoreHint: number;
}

export interface PublicEffectCandidate {
  readonly kind: "creature" | "base" | "lane" | "coordinate" | "graveyard";
  readonly id: string;
  readonly label: string;
}

export interface PublicEffectChoice {
  readonly effectId: string;
  readonly sourceInstanceId: BattleCardInstanceId;
  readonly selectionKinds: readonly PublicEffectCandidate["kind"][];
  readonly candidates: readonly PublicEffectCandidate[];
  readonly minimumTargets?: number;
  readonly maximumTargets?: number;
}

export interface BattleLogEntry {
  readonly sequence: number;
  readonly message: string;
  readonly type: BattleEventType;
  readonly side?: BattleSide;
  /** Present only when this event was produced by a card effect.  This
   * snapshot is retained so the log remains inspectable after the card moves
   * to a non-public zone. */
  readonly sourceCard?: BattleLogSourceCard;
}

export interface BattleLogSourceCard {
  readonly instanceId: BattleCardInstanceId;
  readonly catalogCardId: string;
  readonly name: string;
  readonly type: BattleCardInstance["type"];
  readonly attribute: CardAttribute;
  readonly controllerSide: BattleSide;
  readonly currentAttack?: number;
  readonly currentHp?: number;
  readonly maxHp?: number;
  readonly movement: number;
  readonly effectText: string;
}

export interface BattleLogState {
  readonly entries: readonly BattleLogEntry[];
  readonly terminalSummary?: BattleTerminalResult;
}
