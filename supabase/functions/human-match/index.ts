import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createBattleState, GameEngine } from "../_shared/domain-battle.js";

const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" };
const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Authentication is required" }, 401);
  const admin = createClient(url, serviceKey);
  const userResult = await admin.auth.getUser(token);
  const user = userResult.data.user;
  if (userResult.error || !user || !user.is_anonymous) return json({ error: "Anonymous authentication is required" }, 401);
  try {
    const body: unknown = await request.json();
    if (!isRecord(body) || typeof body.operation !== "string") return json({ error: "Invalid match request" }, 400);
    if (body.operation === "join") return await join(admin, user.id, body);
    if (body.operation === "status") return await status(admin, user.id);
    if (body.operation === "cancel") return await cancel(admin, user.id);
    if (body.operation === "heartbeat") return await heartbeat(admin, user.id);
    if (body.operation === "command") return await command(admin, user.id, body);
    if (body.operation === "release") return await release(admin, user.id);
    return json({ error: "Unknown match operation" }, 400);
  } catch (error) {
    console.error("human-match failed", error);
    return json({ error: "Online match request failed" }, 500);
  }
});

async function join(admin: any, userId: string, body: Record<string, unknown>): Promise<Response> {
  if (typeof body.playerName !== "string" || !body.playerName.trim() || !isRecord(body.playerDeck) || !isRecord(body.catalog)) return json({ error: "Invalid match request" }, 400);
  const passphraseHash = typeof body.passphrase === "string" && body.passphrase.trim() ? await sha256(body.passphrase.trim()) : null;
  const claim = await admin.rpc("claim_online_match", { p_user_id: userId, p_player_name: body.playerName.trim(), p_passphrase_hash: passphraseHash, p_deck: body.playerDeck });
  if (claim.error) throw claim.error;
  const opponent = claim.data?.[0];
  if (!opponent?.matched) return json({ status: "waiting", userId });
  const setup = createBattleState({ playerDeck: body.playerDeck, cpuDeck: opponent.opponent_deck, catalog: hydrateCatalog(body.catalog), firstPlayerMode: "random", now: new Date().toISOString(), seed: crypto.randomUUID() });
  if (!setup.ok) return json({ error: "The selected deck is no longer valid" }, 422);
  const inserted = await admin.from("online_human_battles").insert({ player_user_id: userId, cpu_user_id: opponent.opponent_user_id, player_name: body.playerName.trim(), cpu_name: opponent.opponent_name, game_state: { state: setup.state }, expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() }).select().single();
  if (inserted.error || !inserted.data) throw inserted.error;
  const battle = inserted.data;
  await publishBattle(admin, battle, setup.events);
  await publish(admin, `match:${opponent.opponent_user_id}`, "matched", connectionPayload(battle, "cpu", setup.events));
  return json({ status: "matched", connection: connectionPayload(battle, "player", setup.events) });
}

async function status(admin: any, userId: string): Promise<Response> {
  const battle = await findBattle(admin, userId);
  return json(battle ? { status: "matched", connection: connectionPayload(battle, sideFor(battle, userId), []) } : { status: "waiting", userId });
}

async function cancel(admin: any, userId: string): Promise<Response> {
  const result = await admin.from("online_match_waiters").delete().eq("auth_user_id", userId);
  if (result.error) throw result.error;
  await admin.auth.admin.deleteUser(userId);
  return json({ status: "cancelled" });
}

async function release(admin: any, userId: string): Promise<Response> {
  const battle = await findBattle(admin, userId);
  if (!battle || battle.status !== "finished") return json({ status: "ignored" });
  const deleted = await admin.from("online_human_battles").delete().eq("id", battle.id);
  if (deleted.error) throw deleted.error;
  await Promise.all([admin.auth.admin.deleteUser(battle.player_user_id), admin.auth.admin.deleteUser(battle.cpu_user_id)]);
  return json({ status: "released" });
}

async function heartbeat(admin: any, userId: string): Promise<Response> {
  const battle = await findBattle(admin, userId);
  if (!battle) return json({ status: "waiting" });
  const timedOut = await resolveTimeout(admin, battle);
  if (timedOut) return json({ status: "finished" });
  const field = sideFor(battle, userId) === "player" ? "player_heartbeat_at" : "cpu_heartbeat_at";
  const result = await admin.from("online_human_battles").update({ [field]: new Date().toISOString() }).eq("id", battle.id);
  if (result.error) throw result.error;
  return json({ status: "active" });
}

async function command(admin: any, userId: string, body: Record<string, unknown>): Promise<Response> {
  if (!isRecord(body.command)) return json({ error: "Invalid battle command" }, 400);
  const battle = await findBattle(admin, userId);
  if (!battle) return json({ error: "Battle not found" }, 404);
  if (await resolveTimeout(admin, battle)) return json({ error: "Battle ended after a disconnect" }, 409);
  const side = sideFor(battle, userId);
  const canonical = mapCommand(body.command, side);
  if (canonical.side !== side) return json({ ok: false, issues: [{ code: "battle.side.inactive", message: "You cannot control the opposing side." }] }, 422);
  const state = battle.game_state.state;
  const result = GameEngine.submitCommand(state, canonical);
  if (!result.ok) return json({ ok: false, issues: result.issues }, 422);
  const nextStatus = result.state.terminalResult ? "finished" : "active";
  const updated = await admin.from("online_human_battles").update({ game_state: { state: result.state }, status: nextStatus, revision: battle.revision + 1, updated_at: new Date().toISOString() }).eq("id", battle.id).eq("revision", battle.revision).select().maybeSingle();
  if (updated.error) throw updated.error;
  if (!updated.data) return json({ error: "A newer battle update is available" }, 409);
  await publishBattle(admin, updated.data, result.events);
  return json({ ok: true, state: viewerState(result.state, side), events: viewerEvents(result.events, side) });
}

async function resolveTimeout(admin: any, battle: any): Promise<boolean> {
  if (battle.status !== "active") return battle.status === "finished";
  const now = Date.now();
  const playerExpired = now - Date.parse(battle.player_heartbeat_at) > 60_000;
  const cpuExpired = now - Date.parse(battle.cpu_heartbeat_at) > 60_000;
  if (!playerExpired && !cpuExpired) return false;
  const losingSide = playerExpired ? "player" : "cpu";
  const result = GameEngine.submitCommand(battle.game_state.state, { type: "resign", side: losingSide });
  if (!result.ok) return false;
  const updated = await admin.from("online_human_battles").update({ game_state: { state: result.state }, status: "finished", revision: battle.revision + 1, updated_at: new Date().toISOString() }).eq("id", battle.id).eq("revision", battle.revision).select().maybeSingle();
  if (!updated.data) return false;
  await publishBattle(admin, updated.data, result.events);
  return true;
}

async function findBattle(admin: any, userId: string): Promise<any | undefined> {
  const result = await admin.from("online_human_battles").select().or(`player_user_id.eq.${userId},cpu_user_id.eq.${userId}`).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (result.error) throw result.error;
  return result.data ?? undefined;
}

function sideFor(battle: any, userId: string): "player" | "cpu" { return battle.player_user_id === userId ? "player" : "cpu"; }
function connectionPayload(battle: any, side: "player" | "cpu", events: readonly any[]) { return { battleId: battle.id, side, opponentName: side === "player" ? battle.cpu_name : battle.player_name, state: viewerState(battle.game_state.state, side), events: viewerEvents(events, side) }; }
async function publishBattle(admin: any, battle: any, events: readonly any[]) { await Promise.all([publish(admin, `battle:${battle.id}:player`, "state", connectionPayload(battle, "player", events)), publish(admin, `battle:${battle.id}:cpu`, "state", connectionPayload(battle, "cpu", events))]); }
async function publish(admin: any, topic: string, event: string, payload: unknown) { const response = await fetch(`${url}/realtime/v1/api/broadcast`, { method: "POST", headers: { authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "content-type": "application/json" }, body: JSON.stringify({ messages: [{ topic, event, payload, private: true }] }) }); if (!response.ok) throw new Error("Realtime broadcast failed"); }

function viewerState(state: any, side: "player" | "cpu"): any {
  const value = side === "player" ? state : swapState(state);
  const hidden = new Set(value.players.cpu.handZone.concat(value.players.cpu.deckZone));
  const cardInstances = Object.fromEntries(Object.entries(value.cardInstances).filter(([id]) => !hidden.has(id)).map(([id, card]: any) => [id, card]));
  return { ...value, players: { ...value.players, cpu: { ...value.players.cpu, deckSnapshot: { ...value.players.cpu.deckSnapshot, cards: [] } } }, cardInstances };
}
function viewerEvents(events: readonly any[], side: "player" | "cpu") { return side === "player" ? events : events.map((event) => ({ ...event, ...(event.side ? { side: swapSide(event.side) } : {}) })); }
function swapState(state: any): any {
  const coordinate = (value: any) => ({ column: 12 - value.column, row: 10 - value.row });
  const id = (value: string) => value === "player-base" ? "cpu-base" : value === "cpu-base" ? "player-base" : value === "neutral-left" ? "neutral-right" : value === "neutral-right" ? "neutral-left" : value;
  const terrain = (value: string) => value === "player-base" ? "cpu-base" : value === "cpu-base" ? "player-base" : value;
  const cards = Object.fromEntries(Object.entries(state.cardInstances).map(([key, card]: any) => [key, { ...card, ownerSide: swapSide(card.ownerSide), controllerSide: swapSide(card.controllerSide), ...(card.position ? { position: coordinate(card.position) } : {}) }]));
  const bases = Object.fromEntries(Object.values(state.bases).map((base: any) => { const nextId = id(base.id); return [nextId, { ...base, id: nextId, coordinate: coordinate(base.coordinate), owner: base.owner === "none" ? "none" : swapSide(base.owner) }]; }));
  return { ...state, activeSide: swapSide(state.activeSide), board: { squares: state.board.squares.map((square: any) => ({ ...square, coordinate: coordinate(square.coordinate), lane: square.lane === "left" ? "right" : square.lane === "right" ? "left" : "center", terrain: terrain(square.terrain) })) }, bases, players: { player: { ...state.players.cpu, side: "player" }, cpu: { ...state.players.player, side: "cpu" } }, cardInstances: cards, metadata: { ...state.metadata, firstPlayer: swapSide(state.metadata.firstPlayer), setup: { ...state.metadata.setup, playerDeckId: state.metadata.setup.cpuDeckId, cpuDeckId: state.metadata.setup.playerDeckId } }, ...(state.terminalResult ? { terminalResult: { ...state.terminalResult, winner: swapSide(state.terminalResult.winner), loser: swapSide(state.terminalResult.loser) } } : {}) };
}
function mapCommand(command: Record<string, unknown>, side: "player" | "cpu"): any { if (side === "player") return command; const coordinate = (value: any) => ({ column: 12 - value.column, row: 10 - value.row }); return { ...command, side: "cpu", ...(isRecord(command.destination) ? { destination: coordinate(command.destination) } : {}), ...(isRecord(command.origin) ? { origin: coordinate(command.origin) } : {}), ...(Array.isArray(command.path) ? { path: command.path.map(coordinate) } : {}), ...(isRecord(command.effectSelection) ? { effectSelection: { ...command.effectSelection, ...(Array.isArray(command.effectSelection.coordinates) ? { coordinates: command.effectSelection.coordinates.map(coordinate) } : {}), ...(Array.isArray(command.effectSelection.baseIds) ? { baseIds: command.effectSelection.baseIds.map((value: string) => value === "player-base" ? "cpu-base" : value === "cpu-base" ? "player-base" : value === "neutral-left" ? "neutral-right" : value === "neutral-right" ? "neutral-left" : value) } : {}) } } : {}) }; }
function swapSide(side: "player" | "cpu"): "player" | "cpu" { return side === "player" ? "cpu" : "player"; }
function hydrateCatalog(value: Record<string, unknown>): any { const cards = value.cards as any[]; const tokens = value.tokens as any[]; return { cards, tokens, version: value.version, cardsById: new Map(cards.map((card) => [card.id, card])), tokensById: new Map(tokens.map((token) => [token.id, token])), effectsByCardId: new Map(), normalCardCount: cards.length, tokenCount: tokens.length }; }
async function sha256(value: string): Promise<string> { const bytes = new TextEncoder().encode(value); const hash = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join(""); }
function isRecord(value: unknown): value is Record<string, any> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function json(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status, headers }); }
