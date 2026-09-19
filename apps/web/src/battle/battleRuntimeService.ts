import {
  appendBattleLogEntries,
  createEmptyBattleLog,
  generateLegalActions,
  GameEngine,
  type BattleCommand,
  type BattleEvent,
  type BattleLogState,
  type BattleState,
  type BattleValidationIssue
} from "@ankake/domain";
import {
  chooseCpuAction,
  projectCpuVisibleState,
  redactCpuForecastHand,
  type CpuStopReason
} from "@ankake/cpu";
import type { BattleDiagnosticSink } from "./battleDiagnostics";
import type { SchedulerYield } from "./scheduler";

export interface BattleRuntimeSession {
  readonly state: BattleState;
  readonly log: BattleLogState;
  readonly lastEvents: readonly BattleEvent[];
}

export interface CpuTurnExecutionResult {
  readonly session: BattleRuntimeSession;
  readonly acceptedCommands: number;
  readonly stopReason: CpuStopReason;
}

/** Invoked after each accepted CPU command so a caller can present it before
 * the CPU chooses its next command. */
export type CpuCommandPresented = (
  session: BattleRuntimeSession,
  previousSession: BattleRuntimeSession
) => Promise<void>;

export type BattleRuntimeSubmission =
  | {
      readonly ok: true;
      readonly session: BattleRuntimeSession;
    }
  | {
      readonly ok: false;
      readonly session: BattleRuntimeSession;
      readonly issues: readonly BattleValidationIssue[];
    };

export function createBattleRuntimeSession(
  state: BattleState,
  events: readonly BattleEvent[]
): BattleRuntimeSession {
  return {
    state,
    log: appendBattleLogEntries(createEmptyBattleLog(), events, state.terminalResult, state),
    lastEvents: events
  };
}

export function submitRuntimeCommand(
  session: BattleRuntimeSession,
  command: BattleCommand,
  diagnostics: BattleDiagnosticSink
): BattleRuntimeSession {
  return attemptRuntimeCommand(session, command, diagnostics).session;
}

export function attemptRuntimeCommand(
  session: BattleRuntimeSession,
  command: BattleCommand,
  diagnostics: BattleDiagnosticSink
): BattleRuntimeSubmission {
  const result = GameEngine.submitCommand(session.state, command);

  if (!result.ok) {
    diagnostics.validationIssues(result.issues);
    return {
      ok: false,
      session,
      issues: result.issues
    };
  }

  diagnostics.events(result.events);
  return {
    ok: true,
    session: {
      state: result.state,
      log: appendBattleLogEntries(session.log, result.events, result.state.terminalResult, result.state),
      lastEvents: result.events
    }
  };
}

export async function executeCpuTurn(
  initialSession: BattleRuntimeSession,
  diagnostics: BattleDiagnosticSink,
  yieldControl: SchedulerYield,
  acceptedCommandLimit = 30,
  onCommandPresented?: CpuCommandPresented
): Promise<CpuTurnExecutionResult> {
  let session = initialSession;
  let acceptedCommands = 0;

  while (
    session.state.phase === "play" &&
    session.state.activeSide === "cpu" &&
    !session.state.terminalResult
  ) {
    if (acceptedCommands >= acceptedCommandLimit) {
      diagnostics.cpuStop("processing-limit");
      const forcedEnd = submitRuntimeCommand(
        session,
        {
          type: "endPlayPhase",
          side: "cpu",
          reason: "cpu"
        },
        diagnostics
      );
      await onCommandPresented?.(forcedEnd, session);
      return {
        session: forcedEnd,
        acceptedCommands,
        stopReason: "processing-limit"
      };
    }

    const legalActions = generateLegalActions(session.state, "cpu");
    const visible = projectCpuVisibleState(session.state, legalActions);
    const decision = chooseCpuAction(visible, (action) => {
      // The strategy receives only the CPU-redacted result, never the
      // authoritative state used to produce it.  This allows it to compare
      // effect resolution and action order without reading hidden zones.
      const forecast = GameEngine.submitCommand(session.state, action.command);
      // A speculative random outcome is not public knowledge.  Do not score
      // such a branch; the regular visible-state heuristic remains available.
      if (!forecast.ok || forecast.state.metadata.rng.position !== session.state.metadata.rng.position) {
        return undefined;
      }
      return redactCpuForecastHand(
        projectCpuVisibleState(forecast.state, []),
        visible.cpuHand.map((card) => card.instanceId)
      );
    });

    if (decision.kind === "stop") {
      diagnostics.cpuStop(decision.reason);
      const ended =
        decision.reason === "terminal"
          ? session
          : submitRuntimeCommand(
              session,
              {
                type: "endPlayPhase",
                side: "cpu",
                reason: "cpu"
              },
              diagnostics
            );
      if (ended !== session) {
        await onCommandPresented?.(ended, session);
      }
      return {
        session: ended,
        acceptedCommands,
        stopReason: decision.reason
      };
    }

    const previousSession = session;
    session = submitRuntimeCommand(session, decision.command, diagnostics);
    acceptedCommands += 1;
    await onCommandPresented?.(session, previousSession);
    await yieldControl();
  }

  return {
    session,
    acceptedCommands,
    stopReason: session.state.terminalResult ? "terminal" : "no-beneficial-action"
  };
}
