-- "N people have done this map": record one row per person who yonders a
-- public map that isn't theirs. Public-readable so the count can be shown;
-- you can only record your own take.
create table if not exists public.map_takes (
  map_id uuid not null references public.maps(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (map_id, user_id)
);
alter table public.map_takes enable row level security;
create policy "map takes are public read" on public.map_takes
  for select using (true);
create policy "own map take insert" on public.map_takes
  for insert with check (auth.uid() = user_id);
