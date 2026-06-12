-- Bookmark a mission to attempt later. Private to the user; surfaces in their
-- Me > Missions alongside the ones they made and are racing.
create table if not exists public.mission_saves (
  mission_id uuid not null references public.missions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (mission_id, user_id)
);
alter table public.mission_saves enable row level security;
create policy "own mission saves read" on public.mission_saves
  for select using (auth.uid() = user_id);
create policy "own mission save insert" on public.mission_saves
  for insert with check (auth.uid() = user_id);
create policy "own mission save delete" on public.mission_saves
  for delete using (auth.uid() = user_id);
