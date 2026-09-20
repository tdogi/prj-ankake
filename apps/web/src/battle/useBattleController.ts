import {
  projectPublicBattleView,
  type BattleCommand,
  type BattleCardView,
  type BattleEvent,
  type BattleLogEntry,
  type BattleState,
  type BattleValidationIssue,
  type BoardCoordinate,
  type FirstPlayerMode,
  type StaticCatalogSnapshot
} from "@ankake/domain";
import type { DeckRepository } from "@ankake/persistence";
import { useEffect, useMemo, useRef, useState } from "react";
import { createConsoleBattleDiagnostics } from "./battleDiagnostics";
import {
  IDLE_BATTLE_INTERACTION,
  cancelBattleInteraction,
  guardEndPlayPhase,
  isBattleInteractionPending,
  prepareMovementConfirmation,
  prepareSummonConfirmation,
  projectBattleInteractionView,
  recoverMovementInteraction,
  recoverSummonInteraction,
  selectMovementCreature,
  selectMovementStep,
  selectSpellHandCard,
  selectEffectTarget,
  prepareEffectConfirmation,
  startSummonEffectSelection,
  selectSummonDestination,
  selectSummonHandCard,
  undoMovementStep,
  type BattleInteractionState,
  type BattleInteractionView
} from "./battleInteraction";
import {
  applyRemoteBattleUpdate,
  attemptRuntimeCommand,
  createBattleRuntimeSession,
  executeCpuTurn,
  type BattleRuntimeSession
} from "./battleRuntimeService";
import {
  getBattleStartDisabledReason,
  loadBattlePreparation,
  startBattle,
  type BattlePreparationState
} from "./battleSetupService";
import { yieldToBrowser } from "./scheduler";

export type BattleRouteViewModel =
  | {
      readonly kind: "preparation";
      readonly preparation: BattlePreparationState;
      readonly startDisabledReason?: string;
    }
  | {
      readonly kind: "battle";
      readonly publicView: ReturnType<typeof projectPublicBattleView>;
      readonly interaction: BattleInteractionView;
      readonly logEntries: readonly BattleLogEntry[];
      readonly cpuStatus: "idle" | "thinking" | "executing" | "completed" | "limit-reached";
      readonly lastValidationIssueCode?: string;
      readonly animationEvent?: BattleEvent;
      readonly activeAttackerInstanceId?: string;
      readonly defeatedCreature?: DefeatedCreaturePresentation;
      readonly destroyedCreatureInstanceIds: readonly string[];
      readonly isAnimating: boolean;
    };

export interface BattleControllerActions {
  readonly returnToMenu: () => void;
  readonly selectPlayerDeck: (deckId: string) => void;
  readonly selectCpuDeck: (deckId: string) => void;
  readonly setFirstPlayerMode: (mode: FirstPlayerMode) => void;
  readonly startBattle: () => Promise<void>;
  readonly submitCommand: (command: BattleCommand) => Promise<void>;
  readonly selectHandCard: (instanceId: string) => void;
  readonly selectBoardCreature: (instanceId: string) => void;
  readonly selectBoardSquare: (coordinate: BoardCoordinate) => void;
  readonly selectEffectCandidate: (id: string) => void;
  readonly undoInteraction: () => void;
  readonly confirmInteraction: () => Promise<void>;
  readonly cancelInteraction: () => void;
  readonly endPlayPhase: () => Promise<void>;
  readonly rematch: () => Promise<void>;
  readonly quitBattle: () => void;
  readonly resignBattle: () => Promise<void>;
}

export interface BattleController {
  readonly viewModel: BattleRouteViewModel;
  readonly actions: BattleControllerActions;
}

export interface BattleControllerInput {
  readonly catalog: StaticCatalogSnapshot;
  readonly repository: DeckRepository;
  readonly onReturnToMenu: () => void;
  readonly initialPlayerDeckId?: string;
  readonly onlineBattle?: OnlineBattleTransport;
  readonly onReturnToOnlinePreparation?: () => void;
}

export interface OnlineBattleTransport {
  readonly initialState: BattleState;
  readonly initialEvents: readonly BattleEvent[];
  submitCommand(command: BattleCommand): Promise<
    | { readonly ok: true; readonly state: BattleState; readonly events: readonly BattleEvent[] }
    | { readonly ok: false; readonly issues: readonly BattleValidationIssue[] }
  >;
}

type CpuStatus = "idle" | "thinking" | "executing" | "completed" | "limit-reached";

interface DefeatedCreaturePresentation {
  readonly squareKey: string;
  readonly card: BattleCardView;
}

export function getCpuStatusAfterExecution(
  stopReason: Awaited<ReturnType<typeof executeCpuTurn>>["stopReason"],
  hasTerminalResult: boolean
): CpuStatus {
  if (hasTerminalResult) {
    return "completed";
  }

  return stopReason === "processing-limit" ? "limit-reached" : "completed";
}

export function useBattleController(input: BattleControllerInput): BattleController {
  const diagnostics = useMemo(() => createConsoleBattleDiagnostics(), []);
  const [preparation, setPreparation] = useState<BattlePreparationState>({
    deckOptions: [],
    firstPlayerMode: "random",
    loading: true
  });
  const [session, setSession] = useState<BattleRuntimeSession | undefined>(() =>
    input.onlineBattle
      ? createBattleRuntimeSession(input.onlineBattle.initialState, input.onlineBattle.initialEvents)
      : undefined
  );
  const [interaction, setInteraction] = useState<BattleInteractionState>(
    IDLE_BATTLE_INTERACTION
  );
  const [cpuStatus, setCpuStatus] = useState<CpuStatus>("idle");
  const [lastValidationIssueCode, setLastValidationIssueCode] = useState<string | undefined>();
  const [animationEvent, setAnimationEvent] = useState<BattleEvent | undefined>();
  const [activeAttackerInstanceId, setActiveAttackerInstanceId] = useState<string | undefined>();
  const activeAttackerInstanceIdRef = useRef<string | undefined>();
  const cpuExecutionGenerationRef = useRef(0);
  const [defeatedCreature, setDefeatedCreature] = useState<DefeatedCreaturePresentation | undefined>();
  const [destroyedCreatureInstanceIds, setDestroyedCreatureInstanceIds] = useState<readonly string[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (input.onlineBattle) return;
    let cancelled = false;
    loadBattlePreparation(input.repository, input.initialPlayerDeckId).then((next) => {
      if (!cancelled) {
        setPreparation(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [input.initialPlayerDeckId, input.onlineBattle, input.repository]);

  useEffect(() => {
    if (!input.onlineBattle) return;
    setSession(createBattleRuntimeSession(input.onlineBattle.initialState, input.onlineBattle.initialEvents));
    setInteraction(IDLE_BATTLE_INTERACTION);
  }, [input.onlineBattle?.initialState, input.onlineBattle?.initialEvents]);

  useEffect(() => {
    if (!isBattleInteractionPending(interaction)) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setInteraction(cancelBattleInteraction());
        setLastValidationIssueCode(undefined);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [interaction]);

  useEffect(() => {
    if (
      !session ||
      session.state.activeSide === "cpu" ||
      session.state.phase === "terminal" ||
      session.state.terminalResult
    ) {
      setInteraction(IDLE_BATTLE_INTERACTION);
    }
  }, [session]);

  async function startSelectedBattle(): Promise<void> {
    if (input.onlineBattle) return;
    const disabledReason = getBattleStartDisabledReason(preparation);
    if (disabledReason || !preparation.playerDeckId || !preparation.cpuDeckId) {
      setPreparation({
        ...preparation,
        error: disabledReason ?? "Select battle decks first."
      });
      return;
    }

    setPreparation({
      ...preparation,
      loading: true,
      error: undefined
    });

    const result = await startBattle({
      repository: input.repository,
      catalog: input.catalog,
      playerDeckId: preparation.playerDeckId,
      cpuDeckId: preparation.cpuDeckId,
      firstPlayerMode: preparation.firstPlayerMode
    });

    if (!result.ok) {
      setPreparation({
        ...preparation,
        loading: false,
        error: result.issues[0]?.message ?? "Battle could not start."
      });
      return;
    }

    diagnostics.seed(result.state.metadata.setup.seed);
    cpuExecutionGenerationRef.current += 1;
    const nextSession = createBattleRuntimeSession(result.state, result.events);
    setInteraction(IDLE_BATTLE_INTERACTION);
    activeAttackerInstanceIdRef.current = undefined;
    setActiveAttackerInstanceId(undefined);
    setSession(nextSession);
    setPreparation({
      ...preparation,
      loading: false
    });
    await runCpuIfNeeded(nextSession);
  }

  async function submitCommand(command: BattleCommand): Promise<void> {
    if (!session) {
      return;
    }

    if (input.onlineBattle) {
      const remote = await input.onlineBattle.submitCommand(command);
      if (!remote.ok) {
        setLastValidationIssueCode(remote.issues[0]?.code);
        return;
      }
      const nextSession = applyRemoteBattleUpdate(session, remote.state, remote.events);
      setLastValidationIssueCode(undefined);
      await playBattleEvents(nextSession.lastEvents, session, nextSession);
      setSession(nextSession);
      setCpuStatus(nextSession.state.terminalResult ? "completed" : "idle");
      return;
    }

    const attempted = attemptRuntimeCommand(session, command, diagnostics);
    if (!attempted.ok) {
      setLastValidationIssueCode(attempted.issues[0]?.code);
      return;
    }
    setLastValidationIssueCode(undefined);
    await playBattleEvents(attempted.session.lastEvents, session, attempted.session);
    setSession(attempted.session);
    await runCpuIfNeeded(attempted.session);
  }

  async function endPlayPhase(): Promise<void> {
    if (!session || isAnimating) {
      return;
    }

    if (isBattleInteractionPending(interaction)) {
      setInteraction(guardEndPlayPhase(interaction));
      return;
    }

    await submitCommand({
      type: "endPlayPhase",
      side: session.state.activeSide,
      reason: "manual"
    });
  }

  async function runCpuIfNeeded(nextSession: BattleRuntimeSession): Promise<void> {
    if (input.onlineBattle) {
      setCpuStatus(nextSession.state.terminalResult ? "completed" : "idle");
      return;
    }
    if (nextSession.state.phase !== "play" || nextSession.state.activeSide !== "cpu") {
      if (nextSession.state.phase === "terminal" || nextSession.state.terminalResult) {
        setInteraction(IDLE_BATTLE_INTERACTION);
      }
      setCpuStatus("idle");
      return;
    }

    setInteraction(IDLE_BATTLE_INTERACTION);
    setCpuStatus("thinking");
    const executionGeneration = ++cpuExecutionGenerationRef.current;
    await yieldToBrowser();
    if (executionGeneration !== cpuExecutionGenerationRef.current) {
      return;
    }
    setCpuStatus("executing");
    const result = await executeCpuTurn(nextSession, diagnostics, yieldToBrowser, 30, async (presentedSession, previousSession) => {
      await playBattleEvents(presentedSession.lastEvents, previousSession, presentedSession);
      setSession(presentedSession);
    });
    setSession(result.session);
    setCpuStatus(
      getCpuStatusAfterExecution(
        result.stopReason,
        Boolean(result.session.state.terminalResult)
      )
    );
  }

  async function rematch(): Promise<void> {
    if (isAnimating) return;
    if (input.onlineBattle) {
      input.onReturnToOnlinePreparation?.();
      return;
    }
    setInteraction(IDLE_BATTLE_INTERACTION);
    setLastValidationIssueCode(undefined);
    setSession(undefined);
    await startSelectedBattle();
  }

  function quitBattle(): void {
    if (isAnimating) return;
    if (input.onlineBattle) {
      input.onReturnToOnlinePreparation?.();
      return;
    }
    setInteraction(IDLE_BATTLE_INTERACTION);
    setLastValidationIssueCode(undefined);
    setSession(undefined);
  }

  async function resignBattle(): Promise<void> {
    if (!session || isAnimating) return;

    if (input.onlineBattle) {
      setInteraction(IDLE_BATTLE_INTERACTION);
      await submitCommand({ type: "resign", side: "player" });
      return;
    }

    // A resignation remains valid while the CPU is preparing its turn.  Stop
    // that deferred execution before resolving the terminal result.
    cpuExecutionGenerationRef.current += 1;
    setInteraction(IDLE_BATTLE_INTERACTION);
    setLastValidationIssueCode(undefined);
    const attempted = attemptRuntimeCommand(
      session,
      { type: "resign", side: "player" },
      diagnostics
    );
    if (!attempted.ok) {
      setLastValidationIssueCode(attempted.issues[0]?.code);
      return;
    }

    await playBattleEvents(attempted.session.lastEvents, session, attempted.session);
    setSession(attempted.session);
    setCpuStatus("completed");
  }

  function selectHandCard(instanceId: string): void {
    if (!session || isAnimating) {
      return;
    }

    setLastValidationIssueCode(undefined);
    const card = session.state.cardInstances[instanceId];
    if (card?.type === "spell") {
      const next = selectSpellHandCard(interaction, session.state, instanceId);
      if (next) {
        setInteraction(next);
      } else {
        setInteraction(IDLE_BATTLE_INTERACTION);
        void submitCommand({ type: "castSpell", side: "player", handInstanceId: instanceId });
      }
      return;
    }

    setInteraction((current) =>
      selectSummonHandCard(current, session.state, instanceId)
    );
  }

  function selectBoardSquare(coordinate: BoardCoordinate): void {
    if (!session || isAnimating) {
      return;
    }

    setLastValidationIssueCode(undefined);
    if (interaction.kind === "selecting-summon") {
      const selected = selectSummonDestination(interaction, coordinate);
      if (selected === interaction || selected.kind !== "selecting-summon") return;
      const nextEffect = startSummonEffectSelection(
        session.state,
        selected.handInstanceId,
        selected.destination!
      );
      if (nextEffect) {
        setInteraction(nextEffect);
      } else {
        void confirmInteraction(selected);
      }
      return;
    }

    if (interaction.kind === "selecting-move") {
      const selected = selectMovementStep(interaction, session.state, coordinate);
      if (selected === interaction || selected.kind !== "selecting-move") return;
      if (selected.path.length === selected.maximumMovement) {
        void confirmInteraction(selected);
      } else {
        setInteraction(selected);
      }
      return;
    }

    if (interaction.kind === "selecting-effect") {
      const candidateId = effectCandidateAtBoardSquare(
        interaction,
        session.state,
        coordinate
      );
      if (candidateId) {
        advanceEffectSelection(interaction, candidateId);
      }
    }
  }

  function selectBoardCreature(instanceId: string): void {
    if (!session || isAnimating) {
      return;
    }

    setLastValidationIssueCode(undefined);
    if (interaction.kind === "selecting-effect") {
      advanceEffectSelection(interaction, instanceId);
      return;
    }

    setInteraction((current) =>
      selectMovementCreature(current, session.state, instanceId)
    );
  }

  function selectEffectCandidate(id: string): void {
    if (isAnimating) return;
    setLastValidationIssueCode(undefined);
    advanceEffectSelection(interaction, id);
  }

  function advanceEffectSelection(
    current: BattleInteractionState,
    candidateId: string
  ): void {
    const selected = selectEffectTarget(current, candidateId);
    if (selected === current) return;
    const preparation = prepareEffectConfirmation(selected);
    if (preparation.ok) {
      void confirmInteraction(selected);
    } else {
      setInteraction(selected);
    }
  }

  function undoInteraction(): void {
    if (!session || isAnimating) {
      return;
    }

    setLastValidationIssueCode(undefined);
    setInteraction((current) => undoMovementStep(current, session.state));
  }

  async function confirmInteraction(
    interactionToConfirm: BattleInteractionState = interaction
  ): Promise<void> {
    if (!session) {
      return;
    }

    if (interactionToConfirm.kind === "selecting-summon" && interactionToConfirm.destination) {
      const nextEffect = startSummonEffectSelection(session.state, interactionToConfirm.handInstanceId, interactionToConfirm.destination);
      if (nextEffect) { setInteraction(nextEffect); return; }
    }
    const isMovement = interactionToConfirm.kind === "selecting-move";
    const isEffect = interactionToConfirm.kind === "selecting-effect";
    const preparation = isEffect
      ? prepareEffectConfirmation(interactionToConfirm)
      : isMovement
      ? prepareMovementConfirmation(interactionToConfirm, session.state)
      : prepareSummonConfirmation(interactionToConfirm, session.state);
    if (!preparation.ok) {
      setLastValidationIssueCode(undefined);
      setInteraction(preparation.interaction);
      return;
    }

    if (input.onlineBattle) {
      const remote = await input.onlineBattle.submitCommand(preparation.command);
      if (!remote.ok) {
        setLastValidationIssueCode(remote.issues[0]?.code);
        setInteraction({
          ...interactionToConfirm,
          issue: {
            code: remote.issues[0]?.code ?? "battle.effect.no-target",
            message: remote.issues[0]?.message ?? "The online battle command was rejected."
          }
        });
        return;
      }
      const nextSession = applyRemoteBattleUpdate(session, remote.state, remote.events);
      setInteraction(IDLE_BATTLE_INTERACTION);
      setLastValidationIssueCode(undefined);
      await playBattleEvents(nextSession.lastEvents, session, nextSession);
      setSession(nextSession);
      setCpuStatus(nextSession.state.terminalResult ? "completed" : "idle");
      return;
    }

    const submission = attemptRuntimeCommand(
      session,
      preparation.command,
      diagnostics
    );
    if (!submission.ok) {
      setLastValidationIssueCode(submission.issues[0]?.code);
      setInteraction(
        isEffect
          ? { ...interactionToConfirm, issue: { code: submission.issues[0]?.code ?? "battle.effect.no-target", message: submission.issues[0]?.message ?? "Selected targets are no longer valid." } }
          : isMovement
          ? recoverMovementInteraction(
              submission.session.state,
              interactionToConfirm,
              submission.issues
            )
          : recoverSummonInteraction(
              submission.session.state,
              interactionToConfirm,
              submission.issues
            )
      );
      return;
    }

    setInteraction(IDLE_BATTLE_INTERACTION);
    setLastValidationIssueCode(undefined);
    await playBattleEvents(submission.session.lastEvents, session, submission.session);
    setSession(submission.session);
    await runCpuIfNeeded(submission.session);
  }

  async function playBattleEvents(
    events: readonly BattleEvent[],
    previousSession: BattleRuntimeSession,
    resultingSession: BattleRuntimeSession
  ): Promise<void> {
    if (events.length === 0) return;
    const previousView = projectPublicBattleView(previousSession.state);
    const currentView = projectPublicBattleView(resultingSession.state);
    setIsAnimating(true);
    setDestroyedCreatureInstanceIds([]);
    for (const event of events) {
      // Removing the class for a frame makes repeated damage or movement
      // events restart their CSS animation on the same target.
      // Keep a lethal creature mounted while changing from its damage event
      // to the following destruction event, so it cannot disappear before
      // its destruction animation begins.
      const defeated = defeatedCreatureFor(event, previousView, currentView);
      const nextActiveAttackerInstanceId = activeAttackerForEvent(
        activeAttackerInstanceIdRef.current,
        event
      );
      if (nextActiveAttackerInstanceId !== activeAttackerInstanceIdRef.current) {
        activeAttackerInstanceIdRef.current = nextActiveAttackerInstanceId;
        setActiveAttackerInstanceId(nextActiveAttackerInstanceId);
      }
      setAnimationEvent(undefined);
      setDefeatedCreature(defeated);
      await waitForBattlePresentation(16);
      setAnimationEvent(event);
      await waitForBattlePresentation(eventDuration(event));
      if (event.type === "creature.destroyed" && event.instanceId) {
        setDestroyedCreatureInstanceIds((current) => [...new Set([...current, event.instanceId!])]);
      }
    }
    setAnimationEvent(undefined);
    setDefeatedCreature(undefined);
    setDestroyedCreatureInstanceIds([]);
    setIsAnimating(false);
  }

  function cancelInteraction(): void {
    setInteraction(cancelBattleInteraction());
    setLastValidationIssueCode(undefined);
  }

  const viewModel: BattleRouteViewModel = session
    ? (() => {
        const publicView = projectPublicBattleView(session.state);
        return {
          kind: "battle",
          publicView,
          interaction: projectBattleInteractionView(interaction, publicView),
          logEntries: session.log.entries,
          cpuStatus,
          lastValidationIssueCode,
          animationEvent,
          activeAttackerInstanceId,
          defeatedCreature,
          destroyedCreatureInstanceIds,
          isAnimating
        };
      })()
    : {
        kind: "preparation",
        preparation,
        startDisabledReason: getBattleStartDisabledReason(preparation)
      };

  return {
    viewModel,
    actions: {
      returnToMenu: () => {
        if (isAnimating) return;
        setInteraction(IDLE_BATTLE_INTERACTION);
        setLastValidationIssueCode(undefined);
        input.onReturnToMenu();
      },
      selectPlayerDeck: (deckId) => {
        setPreparation({
          ...preparation,
          playerDeckId: deckId,
          error: undefined
        });
      },
      selectCpuDeck: (deckId) => {
        setPreparation({
          ...preparation,
          cpuDeckId: deckId,
          error: undefined
        });
      },
      setFirstPlayerMode: (mode) => {
        setPreparation({
          ...preparation,
          firstPlayerMode: mode,
          error: undefined
        });
      },
      startBattle: startSelectedBattle,
      submitCommand,
      selectHandCard,
      selectBoardCreature,
      selectBoardSquare,
      selectEffectCandidate,
      undoInteraction,
      confirmInteraction,
      cancelInteraction,
      endPlayPhase,
      rematch,
      quitBattle,
      resignBattle
    }
  };
}

function eventDuration(event: BattleEvent): number {
  switch (event.type) {
    case "creature.summoned":
    case "creature.moved":
    case "creature.damaged":
    case "creature.destroyed":
    case "base.damaged":
    case "base.captured":
      return 440;
    case "phase.ended":
    case "attack.phase-started":
    case "battle.ended":
      return 520;
    default:
      return 300;
  }
}

function waitForBattlePresentation(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export function defeatedCreatureFor(
  event: BattleEvent,
  previousView: ReturnType<typeof projectPublicBattleView>,
  currentView: ReturnType<typeof projectPublicBattleView>
): DefeatedCreaturePresentation | undefined {
  const damagedTargetId = typeof event.data?.targetId === "string" ? event.data.targetId : undefined;
  const targetId = event.type === "creature.damaged"
    ? damagedTargetId
    : event.type === "creature.destroyed"
      ? event.instanceId
      : undefined;
  if (!targetId) {
    return undefined;
  }
  if (event.type === "creature.damaged" && (typeof event.data?.remainingHp !== "number" || event.data.remainingHp > 0)) {
    return undefined;
  }
  const previousSquare = previousView.boardSquares.find(
    (square) => square.occupant?.instanceId === targetId
  );
  const remainsOnBoard = currentView.boardSquares.some(
    (square) => square.occupant?.instanceId === targetId
  );
  if (!previousSquare?.occupant || remainsOnBoard) return undefined;

  return {
    squareKey: previousSquare.key,
    card: { ...previousSquare.occupant, currentHp: 0 }
  };
}

export function activeAttackerForEvent(
  currentAttackerInstanceId: string | undefined,
  event: BattleEvent
): string | undefined {
  if (event.type === "attack.attacker-started") {
    return event.instanceId;
  }

  if (event.type === "attack.phase-ended" || event.type === "battle.ended") {
    return undefined;
  }

  return currentAttackerInstanceId;
}

function effectCandidateAtBoardSquare(
  interaction: Extract<BattleInteractionState, { kind: "selecting-effect" }>,
  state: BattleRuntimeSession["state"],
  coordinate: BoardCoordinate
): string | undefined {
  const square = state.board.squares.find(
    (candidate) =>
      candidate.coordinate.column === coordinate.column &&
      candidate.coordinate.row === coordinate.row
  );
  if (!square) return undefined;

  const isRequiredNext = (
    kind: "creature" | "base" | "lane" | "coordinate" | "graveyard"
  ): boolean => {
    const required = interaction.requirements?.[kind];
    return required !== undefined && interaction.selectedIds.filter((id) =>
      interaction.candidates.some((candidate) => candidate.id === id && candidate.kind === kind)
    ).length < required;
  };
  const candidateOf = (
    kind: typeof interaction.candidates[number]["kind"],
    id: string | undefined
  ) => id && interaction.candidates.some((candidate) => candidate.kind === kind && candidate.id === id) ? id : undefined;

  // AK-044 combines a lane and coordinates.  Selecting its lane first makes
  // a click on a board square unambiguous, after which coordinates are chosen.
  const lane = candidateOf("lane", square.lane);
  if (lane && isRequiredNext("lane")) return lane;

  const creature = candidateOf("creature", square.occupantId);
  if (creature) return creature;

  const base = candidateOf(
    "base",
    Object.values(state.bases).find(
      (candidate) =>
        candidate.coordinate.column === coordinate.column &&
        candidate.coordinate.row === coordinate.row
    )?.id
  );
  if (base) return base;

  const coordinateId = `${coordinate.column}:${coordinate.row}`;
  const coordinateCandidate = candidateOf("coordinate", coordinateId);
  if (coordinateCandidate) return coordinateCandidate;

  return lane;
}
