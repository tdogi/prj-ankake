alter table public.online_battles
  add column access_token uuid not null default gen_random_uuid();
