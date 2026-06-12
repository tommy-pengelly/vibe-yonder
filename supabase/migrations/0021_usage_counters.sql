-- Metered free-tier usage (e.g. mission attempts per month). `period` is a
-- bucket like '2026-06'. Client-side advisory metering (own read + write);
-- hard server-side enforcement can come later if needed.
create table if not exists public.usage_counters (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  period text not null,
  count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, key, period)
);
alter table public.usage_counters enable row level security;
create policy "own usage read" on public.usage_counters
  for select using (auth.uid() = user_id);
create policy "own usage insert" on public.usage_counters
  for insert with check (auth.uid() = user_id);
create policy "own usage update" on public.usage_counters
  for update using (auth.uid() = user_id);
