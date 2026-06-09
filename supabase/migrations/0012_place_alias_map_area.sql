-- Favourite aliases: a personal nickname for a saved place ("Home", "Work",
-- "Best café") shown instead of the raw place name.
alter table public.places add column if not exists alias text;

-- Map area: a human area label ("London, UK") derived from a map's places on
-- save, for nicer cards + community search. Nullable/additive.
alter table public.maps add column if not exists area text;
