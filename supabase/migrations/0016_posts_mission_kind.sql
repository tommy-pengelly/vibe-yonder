-- Missions are flat community content: a created mission posts to the feed like
-- a yonder/map/ways. Allow the new kind on posts.
alter table public.posts drop constraint if exists posts_kind_check;
alter table public.posts
  add constraint posts_kind_check check (kind in ('yonder', 'map', 'ways', 'mission'));
