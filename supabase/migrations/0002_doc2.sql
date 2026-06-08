-- Vibe Yonder: Doc 2 additions (account & history)
-- Apply after 0001_init.sql.

-- Mode on lists (single / collection / ordered)
alter table lists
  add column if not exists mode text not null default 'collection'
  check (mode in ('single', 'collection', 'ordered'));

-- Save-for-later: bookmark a place or a list
create table if not exists saved (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('place', 'list')),
  ref_id uuid not null,
  name text not null,
  lat double precision,
  lon double precision,
  created_at timestamptz default now()
);

alter table saved enable row level security;

create policy "own saved"
  on saved for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Per-user settings (currently just hide_numbers)
create table if not exists settings (
  user_id uuid primary key references auth.users on delete cascade,
  hide_numbers boolean not null default false,
  updated_at timestamptz default now()
);

alter table settings enable row level security;

create policy "own settings"
  on settings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
