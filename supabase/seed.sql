-- Local test seed. Runs on `supabase db reset` (and first `supabase start`).
-- Three explorers with a populated community feed, a mission + leaderboard, a
-- public map, and a follow graph. Emails resolve in Inbucket
-- (http://127.0.0.1:54324) so you can magic-link in as any of them.
-- Idempotent: safe to re-run.

-- ---- Users (the handle_new_user trigger auto-creates their profiles) --------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'authenticated', 'authenticated', 'alice@example.com',
   crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Alice Wander"}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'authenticated', 'authenticated', 'bob@example.com',
   crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Bob Rambles"}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
   'authenticated', 'authenticated', 'cara@example.com',
   crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Cara Strolls"}',
   now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select gen_random_uuid(), u.id, u.id::text,
       json_build_object('sub', u.id::text, 'email', u.email)::jsonb,
       'email', now(), now(), now()
from auth.users u
where u.id in (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'cccccccc-cccc-cccc-cccc-cccccccccccc'
)
on conflict do nothing;

-- ---- Profile handles (trigger set only display_name) ------------------------
update public.profiles set username = 'alicewander', bio = 'Lost on purpose, daily.'
  where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
update public.profiles set username = 'bobrambles', bio = 'Coffee, corners, cul-de-sacs.'
  where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
update public.profiles set username = 'carastrolls', bio = 'Straight lines are a challenge.'
  where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

-- ---- Follow graph (alice follows bob + cara) --------------------------------
insert into public.follows (follower_id, following_id, status)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'accepted'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'accepted'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'accepted')
on conflict do nothing;

-- ---- A mission + its leaderboard -------------------------------------------
insert into public.missions (id, user_id, name, a_lat, a_lon, b_lat, b_lon, distance_m)
values
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'The Panhandle straight shot', 37.7715, -122.4517, 37.7726, -122.4350, 1480)
on conflict (id) do nothing;

insert into public.mission_attempts
  (mission_id, user_id, max_deviation, avg_deviation, in_corridor_pct, medal, path)
values
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 9.4, 4.1, 98, 'platinum',
   '[[0,0],[0.2,4],[0.4,-3],[0.6,6],[0.8,-5],[1,2]]'),
  ('11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 21.8, 12.7, 86, 'gold',
   '[[0,0],[0.2,-12],[0.4,18],[0.6,-15],[0.8,10],[1,-4]]')
on conflict (mission_id, user_id) do nothing;

-- ---- A public map (for the Discover tab) -----------------------------------
insert into public.maps (id, user_id, name, mode, visibility, updated_at)
values
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'Mission District cafés', 'collection', 'public', now())
on conflict (id) do nothing;

insert into public.map_items (id, map_id, name, label, lat, lon, position, visited)
values
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Tartine', 'Guerrero St', 37.7614, -122.4241, 0, false),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Ritual Coffee', 'Valencia St', 37.7569, -122.4216, 1, false),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Dolores Park', 'Dolores St', 37.7596, -122.4269, 2, false)
on conflict do nothing;

-- ---- Community feed: posts of every kind -----------------------------------
insert into public.posts (id, user_id, kind, ref_id, caption, visibility, area, payload)
values
  -- A plain wander (bob)
  ('33333333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'yonder', null, 'Got delightfully lost behind the ballpark.', 'public', 'near South Beach',
   '{"walked_m":3120,"duration_s":2760,"places":4,"yondered":2.4,
     "trace_public":[[8,12],[24,30],[45,22],[60,48],[78,35],[92,64]],
     "destinations":[{"name":"Oracle Park","lat":37.7786,"lon":-122.3893}]}'),
  -- A straight-line mission attempt (cara) -> shows its medal + board link
  ('44444444-4444-4444-4444-444444444444', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
   'yonder', null, 'Held the line. Mostly.', 'public', 'near the Panhandle',
   '{"walked_m":1610,"duration_s":1500,"places":1,"yondered":1.1,
     "trace_public":[[6,50],[28,46],[50,52],[72,48],[94,50]],
     "destinations":[{"name":"The far point","lat":37.7726,"lon":-122.4350}],
     "medal":"gold","missionId":"11111111-1111-1111-1111-111111111111"}'),
  -- A public map post (bob)
  ('55555555-5555-5555-5555-555555555555', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'map', '22222222-2222-2222-2222-222222222222', 'My go-to caffeine crawl.', 'public', null,
   '{"name":"Mission District cafés","destinations":[
     {"name":"Tartine","lat":37.7614,"lon":-122.4241},
     {"name":"Ritual Coffee","lat":37.7569,"lon":-122.4216},
     {"name":"Dolores Park","lat":37.7596,"lon":-122.4269}]}'),
  -- A ways report (cara)
  ('66666666-6666-6666-6666-666666666666', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
   'ways', null, 'Three months of wandering this city.', 'public', null,
   '{"count":42,"km":118.6,"placesSeen":97,"traces":[
     [[10,10],[40,30],[70,20],[90,55]],[[12,80],[35,55],[60,70],[88,40]]]}'),
  -- A mission set (bob) -> flat in the feed
  ('77777777-7777-7777-7777-777777777777', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'mission', '11111111-1111-1111-1111-111111111111', null, 'public', null,
   '{"name":"The Panhandle straight shot","distance_m":1480}')
on conflict (id) do nothing;

-- ---- A few grubs (kudos) on the feed posts ----------------------------------
insert into public.grubs (user_id, subject_type, subject_id)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'yonder', '33333333-3333-3333-3333-333333333333'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'yonder', '33333333-3333-3333-3333-333333333333'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'map', '55555555-5555-5555-5555-555555555555')
on conflict do nothing;
