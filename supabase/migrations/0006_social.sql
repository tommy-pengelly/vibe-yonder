-- Vibe Yonder: Doc 3 — Community & Social.
-- Privacy is paramount: the precise `yonders.track` stays owner-only and
-- untouched. Sharing publishes an OBFUSCATED COPY into shared_yonders (only
-- public-safe fields + an obfuscated trace_public + the shared destinations).

-- ===== profiles: social identity =====
alter table profiles
  add column if not exists username text unique,
  add column if not exists bio text,
  add column if not exists avatar_url text,
  add column if not exists is_private boolean not null default false;

-- Profiles become publicly readable (handles/avatars render for everyone).
drop policy if exists "profiles are self-readable" on profiles;
create policy "profiles are public-readable" on profiles for select using (true);

-- Backfill a username for any existing profile, then seed one on sign-up.
update profiles set username = 'wanderer_' || substr(md5(id::text), 1, 6)
  where username is null;

create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  base text;
begin
  base := nullif(lower(regexp_replace(split_part(coalesce(new.email, ''), '@', 1), '[^a-z0-9]', '', 'g')), '');
  if base is null then base := 'wanderer'; end if;
  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', null),
    left(base, 20) || '_' || substr(md5(new.id::text), 1, 4)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ===== follows (asymmetric) =====
create table if not exists follows (
  follower_id uuid not null references auth.users on delete cascade,
  following_id uuid not null references auth.users on delete cascade,
  status text not null default 'accepted' check (status in ('pending', 'accepted')),
  created_at timestamptz default now(),
  primary key (follower_id, following_id)
);
alter table follows enable row level security;
create policy "follows visible to participants" on follows for select
  using (auth.uid() = follower_id or auth.uid() = following_id);
create policy "follow as self" on follows for insert with check (auth.uid() = follower_id);
create policy "unfollow own" on follows for delete using (auth.uid() = follower_id);
create policy "respond to follow requests" on follows for update
  using (auth.uid() = following_id) with check (auth.uid() = following_id);

-- ===== shared_yonders: the obfuscated public copy =====
create table if not exists shared_yonders (
  id uuid primary key default gen_random_uuid(),
  yonder_id uuid references yonders on delete set null,
  user_id uuid not null references auth.users on delete cascade,
  visibility text not null default 'public' check (visibility in ('followers', 'public')),
  caption text,
  area text,
  walked_m double precision,
  duration_s int,
  places int,
  yondered double precision,
  trace_public jsonb,
  destinations jsonb,
  created_at timestamptz default now()
);
alter table shared_yonders enable row level security;
create policy "own shared yonders" on shared_yonders for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "public shared yonders readable" on shared_yonders for select
  using (visibility = 'public');
create policy "followers shared yonders readable" on shared_yonders for select
  using (
    visibility = 'followers' and exists (
      select 1 from follows f
      where f.following_id = shared_yonders.user_id
        and f.follower_id = auth.uid() and f.status = 'accepted'
    )
  );
create index if not exists shared_yonders_user_created
  on shared_yonders (user_id, created_at desc);

-- ===== grubs (the one-tap kudos) =====
create table if not exists grubs (
  user_id uuid not null references auth.users on delete cascade,
  subject_type text not null check (subject_type in ('yonder', 'map')),
  subject_id uuid not null,
  created_at timestamptz default now(),
  primary key (user_id, subject_type, subject_id)
);
alter table grubs enable row level security;
create policy "grubs public-readable" on grubs for select using (true);
create policy "grub as self" on grubs for insert with check (auth.uid() = user_id);
create policy "ungrub own" on grubs for delete using (auth.uid() = user_id);
create index if not exists grubs_subject on grubs (subject_type, subject_id);

-- ===== maps: public collections =====
alter table maps
  add column if not exists visibility text not null default 'private'
    check (visibility in ('private', 'public')),
  add column if not exists description text;
create policy "public maps readable" on maps for select using (visibility = 'public');
create policy "public map items readable" on map_items for select
  using (exists (select 1 from maps m where m.id = map_items.map_id and m.visibility = 'public'));

-- ===== blocks + reports (safety) =====
create table if not exists blocks (
  blocker_id uuid not null references auth.users on delete cascade,
  blocked_id uuid not null references auth.users on delete cascade,
  created_at timestamptz default now(),
  primary key (blocker_id, blocked_id)
);
alter table blocks enable row level security;
create policy "own blocks" on blocks for all
  using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users on delete cascade,
  target_type text not null,
  target_id uuid not null,
  reason text,
  created_at timestamptz default now()
);
alter table reports enable row level security;
create policy "insert own reports" on reports for insert with check (auth.uid() = reporter_id);

-- ===== settings: privacy (per-account, server-side) =====
alter table settings
  add column if not exists default_visibility text not null default 'private'
    check (default_visibility in ('private', 'followers', 'public')),
  add column if not exists privacy_zone_lat double precision,
  add column if not exists privacy_zone_lon double precision,
  add column if not exists privacy_zone_radius_m int not null default 200;
