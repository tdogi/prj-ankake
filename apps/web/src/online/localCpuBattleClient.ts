import type {
  BattleCommand,
  BattleEvent,
  BattleState,
  BattleValidationIssue,
  SavedDeck,
  StaticCatalogSnapshot
} from "@ankake/domain";

export interface OnlineCpuBattleConnection {
  readonly battleId: string;
  readonly accessToken: string;
  readonly state: BattleState;
  readonly events: readonly BattleEvent[];
}

export interface OnlineCpuBattlePreferences {
  readonly displayName: string;
  readonly passphrase: string;
  readonly playerDeckId: string;
}

export type OnlineCpuBattleSubmission =
  | { readonly ok: true; readonly state: BattleState; readonly events: readonly BattleEvent[] }
  | { readonly ok: false; readonly issues: readonly BattleValidationIssue[] };

export async function startOnlineCpuBattle(input: {
  readonly playerName: string;
  readonly passphrase: string;
  readonly playerDeck: SavedDeck;
  readonly catalog: StaticCatalogSnapshot;
}): Promise<OnlineCpuBattleConnection> {
  const payload = await invokeLocalCpuBattle({
    operation: "start",
    playerName: input.playerName,
    passphrase: input.passphrase,
    playerDeck: input.playerDeck,
    catalog: {
      cards: input.catalog.cards,
      tokens: input.catalog.tokens,
      version: input.catalog.version
    }
  });

  if (!isConnection(payload)) {
    throw new Error("The local online battle server returned an invalid start response.");
  }
  return payload;
}

export async function submitOnlineCpuBattleCommand(
  connection: Pick<OnlineCpuBattleConnection, "battleId" | "accessToken">,
  command: BattleCommand
): Promise<OnlineCpuBattleSubmission> {
  const payload = await invokeLocalCpuBattle({
    operation: "command",
    battleId: connection.battleId,
    accessToken: connection.accessToken,
    command
  });

  if (isSubmission(payload)) {
    return payload;
  }
  throw new Error("The local online battle server returned an invalid command response.");
}

async function invokeLocalCpuBattle(body: Record<string, unknown>): Promise<unknown> {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Local Supabase connection settings are missing.");
  }

  const response = await fetch(`${url}/functions/v1/local-cpu-match`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    if (isSubmission(payload)) return payload;
    throw new Error("The local online battle request failed.");
  }
  return payload;
}

function isConnection(value: unknown): value is OnlineCpuBattleConnection {
  return isRecord(value) && typeof value.battleId === "string" && typeof value.accessToken === "string" && isRecord(value.state) && Array.isArray(value.events);
}

function isSubmission(value: unknown): value is OnlineCpuBattleSubmission {
  return isRecord(value) && typeof value.ok === "boolean" && (
    value.ok
      ? isRecord(value.state) && Array.isArray(value.events)
      : Array.isArray(value.issues)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
