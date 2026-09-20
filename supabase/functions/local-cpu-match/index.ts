import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createBattleState,
  GameEngine,
  generateLegalActions
} from "../_shared/domain-battle.js";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json"
};

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) return json({ error: "Invalid battle request" }, 400);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    if (body.operation === "start") return await startBattle(supabase, body);
    if (body.operation === "command") return await submitCommand(supabase, body);
    return json({ error: "Unknown battle operation" }, 400);
  } catch (error) {
    console.error("local-cpu-match failed", error);
    return json({ error: "Local online battle request failed" }, 500);
  }
});

async function startBattle(supabase: any, body: Record<string, unknown>): Promise<Response> {
  if (typeof body.playerName !== "string" || !body.playerName.trim()) return json({ error: "A player name is required" }, 400);
  const playerDeck = parseDeck(body.playerDeck);
  const catalog = parseCatalog(body.catalog);
  if (!playerDeck || !catalog) return json({ error: "Invalid deck or catalog" }, 400);

  const setup = createBattleState({
    playerDeck,
    cpuDeck: { ...playerDeck, deckId: `local-cpu-${playerDeck.deckId}`, name: "CPU" },
    firstPlayerMode: "random",
    catalog,
    now: new Date().toISOString(),
    seed: crypto.randomUUID()
  });
  if (!setup.ok) return json({ error: "Battle setup failed", issues: setup.issues }, 422);

  const advanced = runCpuTurn(setup.state);
  const { data, error } = await supabase
    .from("online_battles")
    .insert({ player_name: body.playerName.trim(), mode: "local-cpu", game_state: { state: advanced.state } })
    .select("id, access_token")
    .single();
  if (error || !data) return json({ error: "Could not create local online battle" }, 500);

  return json({
    battleId: data.id,
    accessToken: data.access_token,
    state: advanced.state,
    events: [...setup.events, ...advanced.events]
  });
}

async function submitCommand(supabase: any, body: Record<string, unknown>): Promise<Response> {
  if (typeof body.battleId !== "string" || typeof body.accessToken !== "string" || !isBattleCommand(body.command)) return json({ error: "Invalid battle command" }, 400);
  if (body.command.side !== "player") return json({ ok: false, issues: [serverIssue("Only player commands are accepted.")] }, 422);

  const { data: battle, error } = await supabase
    .from("online_battles")
    .select("id, status, game_state")
    .eq("id", body.battleId)
    .eq("access_token", body.accessToken)
    .maybeSingle();
  if (error || !battle) return json({ error: "Online battle was not found" }, 404);
  if (battle.status !== "active") return json({ ok: false, issues: [serverIssue("The battle has already ended.", "battle.terminal")] }, 422);

  const state = stateFromStoredValue(battle.game_state);
  if (!state) return json({ error: "Stored battle state is invalid" }, 500);
  const playerResult = GameEngine.submitCommand(state, body.command);
  if (!playerResult.ok) return json({ ok: false, issues: playerResult.issues }, 422);

  const advanced = playerResult.state.terminalResult
    ? { state: playerResult.state, events: [] as readonly any[] }
    : runCpuTurn(playerResult.state);
  const { error: updateError } = await supabase
    .from("online_battles")
    .update({
      game_state: { state: advanced.state },
      status: advanced.state.terminalResult ? "finished" : "active",
      updated_at: new Date().toISOString()
    })
    .eq("id", battle.id);
  if (updateError) return json({ error: "Could not update local online battle" }, 500);

  return json({ ok: true, state: advanced.state, events: [...playerResult.events, ...advanced.events] });
}

/** Runs CPU commands only on the server, then returns control to the player. */
function runCpuTurn(initialState: any): { readonly state: any; readonly events: readonly any[] } {
  let state = initialState;
  const events: any[] = [];
  for (let attempts = 0; attempts < 30 && state.phase === "play" && state.activeSide === "cpu" && !state.terminalResult; attempts += 1) {
    const legalActions = generateLegalActions(state, "cpu");
    const command = legalActions.find((action: any) => action.command.type !== "endPlayPhase")?.command ?? {
      type: "endPlayPhase" as const,
      side: "cpu" as const,
      reason: "cpu" as const
    };
    const result = GameEngine.submitCommand(state, command);
    if (!result.ok) break;
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}

function parseCatalog(value: unknown): any | undefined {
  if (!isRecord(value) || !Array.isArray(value.cards) || !Array.isArray(value.tokens) || !isRecord(value.version)) return undefined;
  const cards = value.cards;
  const tokens = value.tokens;
  return {
    cards,
    tokens,
    version: value.version,
    cardsById: new Map(cards.map((card: any) => [card.id, card])),
    tokensById: new Map(tokens.map((token: any) => [token.id, token])),
    effectsByCardId: new Map(),
    normalCardCount: cards.length,
    tokenCount: tokens.length
  };
}

function parseDeck(value: unknown): any | undefined {
  if (!isRecord(value) || typeof value.deckId !== "string" || typeof value.name !== "string" || !Array.isArray(value.cards) || typeof value.createdAt !== "string" || typeof value.updatedAt !== "string") return undefined;
  return value;
}

function stateFromStoredValue(value: unknown): any | undefined {
  return isRecord(value) && isRecord(value.state) ? value.state : undefined;
}

function isBattleCommand(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && typeof value.type === "string" && typeof value.side === "string";
}

function serverIssue(message: string, code = "battle.phase.invalid") {
  return { code, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers });
}
