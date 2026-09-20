create table public.online_battles (
  id uuid primary key default gen_random_uuid(),
  player_name text not null,
  opponent_name text not null default 'CPU',
  mode text not null check (mode in ('local-cpu', 'online')),
  status text not null default 'active' check (status in ('active', 'finished')),
  game_state jsonb not null,
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '2 hours'
);

alter table public.online_battles enable row level security;
revoke all on public.online_battles from anon, authenticated;

create or replace function public.delete_expired_online_battles()
returns void language sql security definer set search_path = public
as $$ delete from public.online_battles where expires_at < now() $$;
