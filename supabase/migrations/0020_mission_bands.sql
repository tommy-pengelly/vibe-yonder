-- The creator sets each medal's corridor half-width (metres) per mission.
-- Defaults are the standard tiers, so existing missions keep their meaning.
alter table public.missions
  add column if not exists platinum_m double precision not null default 12.5,
  add column if not exists gold_m double precision not null default 25,
  add column if not exists silver_m double precision not null default 50,
  add column if not exists bronze_m double precision not null default 100;
