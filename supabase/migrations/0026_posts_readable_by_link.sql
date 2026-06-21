-- 0026 — posts readable by link (the "unlisted" model).
--
-- Reads are decoupled from FEED visibility: anyone holding a post's id (an
-- unguessable uuid, i.e. the share link) can read it, whatever its visibility.
-- Feed LISTING is filtered in the queries by visibility (community + search:
-- visibility = 'public'; following: visibility <> 'private'), so a
-- private/unlisted or followers post never appears in a feed it shouldn't,
-- while its /yonder/[id] link still opens for whoever you send it to (logged in
-- or not). The post is already an obfuscated, public-safe memento (no precise
-- route, home zone stripped), so opening reads exposes nothing the owner didn't
-- choose to publish. Writes stay owner-only (the "own posts" policy).

drop policy if exists "public posts readable" on public.posts;
drop policy if exists "followers posts readable" on public.posts;

create policy "posts readable by link" on public.posts
  for select using (true);
