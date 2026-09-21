import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import type { BattleCommand, BattleEvent, BattleState, BattleValidationIssue, SavedDeck, StaticCatalogSnapshot } from "@ankake/domain";

export interface OnlineHumanBattleConnection { readonly battleId: string; readonly revision: number; readonly opponentName: string; readonly side: "player" | "cpu"; readonly state: BattleState; readonly events: readonly BattleEvent[]; readonly client: SupabaseClient; }
type MatchResponse = { readonly status: "waiting" | "matched"; readonly userId?: string; readonly connection?: Omit<OnlineHumanBattleConnection, "client"> };
let pendingClient: SupabaseClient | undefined;

export async function startOnlineHumanBattle(input: { readonly playerName: string; readonly passphrase: string; readonly playerDeck: SavedDeck; readonly catalog: StaticCatalogSnapshot }): Promise<OnlineHumanBattleConnection> {
  const client = await authenticatedClient();
  pendingClient = client;
  const response = await request<MatchResponse>(client, { operation: "join", ...input });
  if (response.status === "matched" && response.connection) { pendingClient = undefined; return { ...response.connection, client }; }
  const userId = response.userId;
  if (!userId) throw new Error("Matchmaking identity is missing.");
  const connection = await waitForMatch(client, userId); pendingClient = undefined; return connection;
}

export async function cancelPendingHumanMatch(): Promise<void> {
  if (!pendingClient) return;
  const client = pendingClient;
  pendingClient = undefined;
  try {
    await request(client, { operation: "cancel" });
  } finally {
    await discardLocalAnonymousSession(client);
  }
}

export async function releaseHumanBattle(connection: OnlineHumanBattleConnection): Promise<void> {
  try {
    await request(connection.client, { operation: "release" });
  } finally {
    await discardLocalAnonymousSession(connection.client);
  }
}

export async function submitOnlineHumanBattleCommand(connection: OnlineHumanBattleConnection, command: BattleCommand): Promise<{ readonly ok: true; readonly state: BattleState; readonly events: readonly BattleEvent[] } | { readonly ok: false; readonly issues: readonly BattleValidationIssue[] }> {
  return await request(connection.client, { operation: "command", command });
}

export function subscribeToHumanBattle(connection: OnlineHumanBattleConnection, onState: (update: Omit<OnlineHumanBattleConnection, "client">) => void, onRealtimeError?: (error: unknown) => void): () => void {
  let synchronizing = false;
  async function synchronize(): Promise<void> {
    if (synchronizing) return;
    synchronizing = true;
    try {
      const current = await request<MatchResponse>(connection.client, { operation: "status" });
      if (current.connection && current.connection.revision > connection.revision) onState(current.connection);
    } catch (error) {
      onRealtimeError?.(error);
    } finally {
      synchronizing = false;
    }
  }
  const channel = connection.client.channel(`battle:${connection.battleId}:${connection.side}`, { config: { private: true } })
    .on("broadcast", { event: "state" }, ({ payload }) => { if (isConnection(payload)) onState(payload); })
    .subscribe((status, error) => { if (status === "CHANNEL_ERROR") { onRealtimeError?.(error); void synchronize(); } });
  const heartbeatTimer = window.setInterval(() => { void request(connection.client, { operation: "heartbeat" }); }, 15_000);
  const recoveryTimer = window.setInterval(() => { if (connection.state.activeSide === "cpu") void synchronize(); }, 5_000);
  return () => { window.clearInterval(heartbeatTimer); window.clearInterval(recoveryTimer); void connection.client.removeChannel(channel); };
}

async function waitForMatch(client: SupabaseClient, userId: string): Promise<OnlineHumanBattleConnection> {
  return await new Promise((resolve, reject) => {
    let completed = false;
    const finish = (connection: Omit<OnlineHumanBattleConnection, "client">) => { if (!completed) { completed = true; void client.removeChannel(channel); resolve({ ...connection, client }); } };
    const channel: RealtimeChannel = client.channel(`match:${userId}`, { config: { private: true } })
      .on("broadcast", { event: "matched" }, ({ payload }) => { if (isConnection(payload)) finish(payload); })
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED" || completed) return;
        try { const current = await request<MatchResponse>(client, { operation: "status" }); if (current.connection) finish(current.connection); } catch (error) { reject(error); }
      });
  });
}

async function authenticatedClient(): Promise<SupabaseClient> {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase connection settings are missing.");
  const client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
  let session = (await client.auth.getSession()).data.session;
  if (session) {
    const user = await client.auth.getUser();
    if (user.error || !user.data.user?.is_anonymous) {
      await discardLocalAnonymousSession(client);
      session = null;
    }
  }
  if (!session) session = (await client.auth.signInAnonymously()).data.session;
  if (!session) throw new Error("Anonymous sign-in failed.");
  await client.realtime.setAuth(session.access_token);
  return client;
}

async function discardLocalAnonymousSession(client: SupabaseClient): Promise<void> {
  await client.removeAllChannels();
  await client.auth.signOut({ scope: "local" });
}

async function request<T>(client: SupabaseClient, body: Record<string, unknown>): Promise<T> {
  const session = (await client.auth.getSession()).data.session;
  if (!session) throw new Error("Anonymous session expired.");
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase connection settings are missing.");
  const response = await fetch(`${url}/functions/v1/human-match`, { method: "POST", headers: { apikey: key, authorization: `Bearer ${session.access_token}`, "content-type": "application/json" }, body: JSON.stringify(body) });
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) throw new Error("Online match request failed.");
  return payload as T;
}

function isConnection(value: unknown): value is Omit<OnlineHumanBattleConnection, "client"> { return typeof value === "object" && value !== null && typeof (value as any).battleId === "string" && typeof (value as any).revision === "number" && ((value as any).side === "player" || (value as any).side === "cpu") && typeof (value as any).opponentName === "string" && typeof (value as any).state === "object" && Array.isArray((value as any).events); }
