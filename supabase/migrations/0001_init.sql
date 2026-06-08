-- Vibe Yonder: initial schema
-- Apply via Supabase SQL editor or the CLI: `supabase db push`

create extension if not exists "pgcrypto";

-- profile mirror of auth.users
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "profiles are self-readable"
  on profiles for select
  using (auth.uid() = id);

create policy "profiles are self-writable"
  on profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);

-- favourite places
create table if not exists places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  label text,
  lat double precision not null,
  lon double precision not null,
  created_at timestamptz default now()
);

alter table places enable row level security;

create policy "own places"
  on places for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- reusable trip lists
create table if not exists lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table lists enable row level security;

create policy "own lists"
  on lists for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references lists on delete cascade,
  name text not null,
  label text,
  lat double precision not null,
  lon double precision not null,
  position int not null default 0,
  visited boolean not null default false,
  visited_at timestamptz,
  created_at timestamptz default now()
);

alter table list_items enable row level security;

create policy "own list items"
  on list_items for all
  using (
    exists (
      select 1 from lists l
      where l.id = list_items.list_id and l.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from lists l
      where l.id = list_items.list_id and l.user_id = auth.uid()
    )
  );

-- saved walks (no elevation, no pace stored)
create table if not exists yonders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_s int,
  distance_m double precision,
  direct_m double precision,
  yondered double precision,
  track jsonb,
  created_at timestamptz default now()
);

alter table yonders enable row level security;

create policy "own yonders"
  on yonders for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- create a profile row whenever a new auth user is added
create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', null))
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
