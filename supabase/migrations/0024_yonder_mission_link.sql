-- 0024 — The keystone of the simplified object model (see SCHEMA.md).
--
-- A yonder is the spine: every outing is a yonder, and it optionally *realises a
-- plan*. It already links to a map (map_id); this gives it the symmetric link to
-- a mission, so a mission attempt is a real, linked, profile-visible, repeatable
-- yonder rather than a detached score. Also records that the outing was a
-- straight-line play and stashes its result (medal, deviations, normalised path).
--
-- Additive + safe: all columns nullable, no backfill needed. The mission_attempts
-- board row stays the public, coordinate-free projection of these mission-yonders.

alter table public.yonders
  add column if not exists mission_id   uuid references public.missions(id) on delete set null,
  add column if not exists play         text not null default 'ambient',  -- 'ambient' | 'straightline'
  add column if not exists straight_line jsonb;                            -- { medal, maxDev, avgDev, inCorridor, path }

-- A yonder realises at most one plan: a map OR a mission, never both.
alter table public.yonders
  drop constraint if exists yonders_one_plan;
alter table public.yonders
  add constraint yonders_one_plan check (map_id is null or mission_id is null);

-- Index the link for "my attempts on this mission" / profile reads.
create index if not exists yonders_mission_id_idx on public.yonders (mission_id);

-- RLS is unchanged: yonders stay owner-only. The new columns inherit the existing
-- owner-scoped policies; no new read path is opened. The public board remains
-- mission_attempts (coordinate-free), never these rows.
