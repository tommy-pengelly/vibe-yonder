-- Straight-line missions: a shared A→B challenge others can attempt, with a
-- public scoreboard ranked by deviation (never time). A mission is created from
-- a completed straight-line yonder, so it's known walkable. Everyone attempts
-- the *same* line A→B for a fair board.

create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  a_lat double precision not null,
  a_lon double precision not null,
  b_lat double precision not null,
  b_lon double precision not null,
  distance_m double precision,
  created_at timestamptz not null default now()
);

alter table public.missions enable row level security;
create policy "missions public read" on public.missions for select using (true);
create policy "own missions write" on public.missions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists missions_created on public.missions (created_at desc);

-- One row per (mission, user): their *best* attempt (upserted on improvement).
create table if not exists public.mission_attempts (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  max_deviation double precision not null,
  avg_deviation double precision not null,
  in_corridor_pct double precision,
  medal text,
  created_at timestamptz not null default now(),
  unique (mission_id, user_id)
);

alter table public.mission_attempts enable row level security;
create policy "attempts public read" on public.mission_attempts for select using (true);
create policy "own attempts write" on public.mission_attempts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists attempts_board
  on public.mission_attempts (mission_id, max_deviation, avg_deviation);
