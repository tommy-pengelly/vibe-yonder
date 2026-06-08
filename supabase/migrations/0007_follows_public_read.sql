-- Public profiles show follower / following counts and lists, so the follow
-- graph is public-readable (Strava-style). Writes stay self-only. Private
-- accounts + follow-request gating are a later phase.
drop policy if exists "follows visible to participants" on follows;
create policy "follows public-readable" on follows for select using (true);
