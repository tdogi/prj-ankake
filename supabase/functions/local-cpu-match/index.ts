import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers });
  const body = await request.json();
  if (typeof body.playerName !== "string" || !body.playerName.trim() || !body.gameState) return new Response("Invalid match request", { status: 400, headers });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await supabase.from("online_battles").insert({ player_name: body.playerName.trim(), mode: "local-cpu", game_state: body.gameState }).select("id, opponent_name, game_state").single();
  if (error) return new Response("Could not create local CPU battle", { status: 500, headers });
  return Response.json({ battleId: data.id, opponentName: data.opponent_name, gameState: data.game_state }, { headers });
});
