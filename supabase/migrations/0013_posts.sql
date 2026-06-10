-- Unified posts: one feed object for the three things you can share — a
-- yonder, a map, or a "ways report" (your exploration overview). The feed reads
-- `posts` instead of joining shared_yonders + public maps separately.
--
-- Privacy is preserved by denormalising a *public-safe* payload into the row
-- (obfuscated trace memento, vague area, stripped coords for yonders) — the feed
-- never touches the private yonders/track. ref_id points back to the source
-- object for the owner only.

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('yonder', 'map', 'ways')),
  ref_id uuid, -- source yonder/map id (null for ways); owner-facing
  caption text,
  visibility text not null default 'public'
    check (visibility in ('private', 'followers', 'public')),
  area text,
  payload jsonb not null default '{}', -- public-safe display fields
  created_at timestamptz not null default now()
);

alter table public.posts enable row level security;

create policy "own posts" on public.posts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "public posts readable" on public.posts
  for select using (visibility = 'public');

create policy "followers posts readable" on public.posts
  for select using (
    visibility = 'followers'
    and exists (
      select 1 from public.follows f
      where f.following_id = posts.user_id
        and f.follower_id = auth.uid()
        and f.status = 'accepted'
    )
  );

create index if not exists posts_user on public.posts (user_id);
create index if not exists posts_vis_created
  on public.posts (visibility, created_at desc);

-- Backfill so existing shared content appears in the new feed.
insert into public.posts (user_id, kind, ref_id, caption, visibility, area, payload, created_at)
select
  s.user_id, 'yonder', s.yonder_id, s.caption, s.visibility, s.area,
  jsonb_build_object(
    'walked_m', s.walked_m, 'duration_s', s.duration_s, 'places', s.places,
    'yondered', s.yondered, 'trace_public', s.trace_public,
    'destinations', s.destinations
  ),
  s.created_at
from public.shared_yonders s
on conflict do nothing;

insert into public.posts (user_id, kind, ref_id, visibility, payload, created_at)
select
  m.user_id, 'map', m.id, 'public',
  jsonb_build_object('name', m.name),
  coalesce(m.updated_at, now())
from public.maps m
where m.visibility = 'public'
on conflict do nothing;
