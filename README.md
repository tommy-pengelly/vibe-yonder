# Vibe Yonder

> Strava for exploring.

Pick a place. Wander there — no route, just an arrow and your own two feet. The walk screen is a full-bleed **scope**: range rings, a steady you-dot, a hero amber arrow anchored to you pointing along the bearing, and a fading trail. The recap celebrates how many times further you walked than the straight line — your **Yondered** score.

## What's in the box

- **Landing** — guest-first; sign-in is optional, prompted contextually when you try to save a yonder
- **Search** — Nominatim-backed, ranked by importance + proximity, "X away" labels. Empty state surfaces Favourites · Your lists · Recent yonders
- **Walk — the scope** — full-bleed canvas with radial fade, 100/250/500 m range rings, steady glowing you-dot, hero amber arrow anchored to you with distance riding with it, fading trail. Optional heading-up toggle. Top-left destination + waypoint counter, top-right orientation toggle (no Cancel). Bottom HUD: Time · Distance, modest Finish, circular pause, "Just take me there ↗". Pause is two-step (Resume / Discard). Trivial walks (<30 m) don't save a recap.
- **Recap** — full-bleed fade-masked trace as hero, "You yondered N×" hero line, editable title, tiles Walked · Time · Direct · **Yondered**. New walk + Save (Save prompts sign-in for guests)
- **Lists & journeys** — stateful (unvisited circle · visited check · "visit again" by toggling); seen places collapse under "Seen (n)" on re-open. Yonder this list: advance manually on each arrival near 30 m. localStorage-persisted in guest mode; Supabase-backed once signed in
- **Explain** — what each stat means and why "yondering" is the point

No turn-by-turn. No map tiles. No pace tracking. No elevation.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind v4 + Fraunces (display) / Inter (body) / JetBrains Mono (live readouts)
- [Nominatim](https://nominatim.openstreetmap.org/) for geocoding (proxied server-side)
- Browser Geolocation + DeviceOrientation + Screen Wake Lock APIs
- Supabase (auth + Postgres + RLS) — optional; app degrades to guest-only when env vars aren't set

## Run it

```bash
npm install
cp .env.example .env.local
npm run dev
```

Sensors require **https** in the browser. For local testing on a phone, use a Vercel preview, `next dev --experimental-https`, or a tunnel like ngrok.

## Supabase setup (optional)

The app runs end-to-end as a guest with everything kept in `localStorage`. To turn on accounts:

1. Create a Supabase project.
2. Run `supabase/migrations/0001_init.sql` in the SQL editor. It creates `profiles` / `places` / `lists` / `list_items` / `yonders`, enables RLS on every table, and adds a trigger that auto-creates a profile row on sign-up.
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in your env (Vercel project settings for production).
4. Sign in via magic link from the landing screen. On first sign-in, any guest yonders in your `localStorage` are uploaded into your account and cleared locally.

## Configuration

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — leave blank for guest-only mode.
- `NOMINATIM_CONTACT` — contact baked into the `User-Agent` header sent to Nominatim. Their policy requires an identifying UA; change before any real traffic.

## Honest constraints

- **No reliable background tracking** — web geolocation pauses when the tab is backgrounded. The app holds a screen wake lock during a walk to mitigate; pocket-tracking isn't possible from a browser.
- **Compass heading is optional** — the scope defaults to **north-up**. Heading-up is a toggle that falls back gracefully when no sensor is available.
- **Elevation is omitted** — GPS altitude is too noisy and the barometer isn't reachable from a browser.

## Roadmap

- Ghost arrows for nearby list places (closest 5, fade by distance, pin / check-off)
- Auto-discovered POIs + Wikipedia blurbs
- Dead-end / no-way-through warnings (OSM pedestrian graph)
- Real OSM tiles under the trail (optional skin)
- Shareable recap image
- PWA / offline / installable
