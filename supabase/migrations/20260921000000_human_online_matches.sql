create table public.online_match_waiters (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  player_name text not null check (length(trim(player_name)) between 1 and 40),
  passphrase_hash text,
  deck jsonb not null,
  created_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now()
);

create table public.online_human_battles (
  id uuid primary key default gen_random_uuid(),
  player_user_id uuid not null references auth.users(id) on delete cascade,
  cpu_user_id uuid not null references auth.users(id) on delete cascade,
  player_name text not null,
  cpu_name text not null,
  game_state jsonb not null,
  revision integer not null default 0,
  status text not null default 'active' check (status in ('active', 'finished')),
  player_heartbeat_at timestamptz not null default now(),
  cpu_heartbeat_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '2 hours',
  constraint online_human_battles_distinct_players check (player_user_id <> cpu_user_id)
);

create index online_match_waiters_match_index
  on public.online_match_waiters (passphrase_hash, created_at);
create index online_human_battles_participants_index
  on public.online_human_battles (player_user_id, cpu_user_id);

alter table public.online_match_waiters enable row level security;
alter table public.online_human_battles enable row level security;
revoke all on public.online_match_waiters, public.online_human_battles from anon, authenticated;

-- Atomically claims the oldest compatible waiter. The Edge Function creates
-- the battle immediately after a claim and is the only caller of this RPC.
create or replace function public.claim_online_match(
  p_user_id uuid,
  p_player_name text,
  p_passphrase_hash text,
  p_deck jsonb
)
returns table(matched boolean, opponent_user_id uuid, opponent_name text, opponent_deck jsonb)
language plpgsql security definer set search_path = public
as $$
declare opponent public.online_match_waiters;
begin
  delete from public.online_match_waiters where auth_user_id = p_user_id;
  select * into opponent
    from public.online_match_waiters
    where auth_user_id <> p_user_id
      and passphrase_hash is not distinct from p_passphrase_hash
    order by created_at
    for update skip locked
    limit 1;

  if found then
    delete from public.online_match_waiters where auth_user_id = opponent.auth_user_id;
    return query select true, opponent.auth_user_id, opponent.player_name, opponent.deck;
    return;
  end if;

  insert into public.online_match_waiters (auth_user_id, player_name, passphrase_hash, deck)
  values (p_user_id, p_player_name, p_passphrase_hash, p_deck);
  return query select false, null::uuid, null::text, null::jsonb;
end;
$$;

create or replace function public.is_online_realtime_participant(p_topic text)
returns boolean language sql stable security definer set search_path = public
as $$
  select p_topic = format('match:%s', auth.uid())
    or exists (
      select 1 from public.online_human_battles battle
      where (p_topic = format('battle:%s:player', battle.id) and battle.player_user_id = auth.uid())
         or (p_topic = format('battle:%s:cpu', battle.id) and battle.cpu_user_id = auth.uid())
    )
$$;

create policy "online participants receive private realtime messages"
on realtime.messages for select to authenticated
using (
  (current_setting('request.jwt.claims', true)::jsonb ->> 'is_anonymous')::boolean
  and realtime.messages.extension in ('broadcast')
  and public.is_online_realtime_participant(realtime.topic())
);

create or replace function public.delete_expired_human_online_data()
returns void language sql security definer set search_path = public
as $$
  delete from public.online_match_waiters where heartbeat_at < now() - interval '1 minute';
  delete from public.online_human_battles where expires_at < now();
$$;
