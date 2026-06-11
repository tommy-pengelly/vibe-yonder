-- A straight-line attempt keeps its shape, normalized to the line frame:
-- an array of [alongFraction 0..1, signedDeviationMetres] points. No absolute
-- coordinates, so it's privacy-safe (the line itself is a public mission).
-- Lets the scoreboard overlay everyone's run around the line.
alter table public.mission_attempts add column if not exists path jsonb;
