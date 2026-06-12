# Yonderful

> Strava for exploring.

Pick a place. Wander there with no route — just a marker pointing the way and your own two feet. The walk screen is a full-bleed **scope**: an empty near-black void, a steady you-dot at the centre, and a small amber **directional head** (a chevron, never an arrow) riding an invisible radius and rotating to point the bearing. A faint **constellation** of nearby discoveries hangs in the sky; a trail draws in behind you. The recap celebrates how far you *wandered* off the straight line — your **Yondered** score.

It is about getting pleasantly lost, not getting there fast. **No pace, no routing, no ETA, no elevation, ever.** See `CLAUDE.md` for the full brand law.

## What's in it

- **Guest-first** — everything works with no account; sign-in (magic link / in-app code) only appears when you want to *save* something. Guest data lives in `localStorage` and imports on sign-up.
- **The scope** — full-bleed heading-up canvas, you-dot, chevron marker, faint discovery constellation, drawing trail. Time + Distance (both hideable — the numbers are optional). No nav chrome; the walk is a takeover.
- **Yonders** — every outing is a *yonder*: a trace, time, places seen, and a Yondered multiplier. The recap can turn one into a map, favourite a place, or share it.
- **Maps** — reusable sets of places you can yonder anytime, do again, or make public.
- **Missions** — a straight-line challenge A→B with medal bands and a board, scored by *holding the line* (deviation), never by time. Attempting one produces a yonder.
- **Community** — a calm feed of yonders from people you follow (or everyone), one-tap **grubs** for kudos, and public Maps / Missions to load and attempt. Sharing is opt-in; a share is an *obfuscated memento*, never your real route.

The data model (yonder · map · mission · post) is documented in **[SCHEMA.md](SCHEMA.md)** — read it before touching the schema or anything social.

## Stack

- Next.js (App Router) + React + TypeScript; Tailwind v4
- Fraunces (display) / a grotesk (body) / mono (live readouts)
- Browser Geolocation + DeviceOrientation + Screen Wake Lock
- **Supabase** (auth + Postgres + RLS on every table) — optional; the app degrades to guest-only when env vars are unset
- Two keyless server routes: `/api/geocode` (Photon, proximity-biased autocomplete; `GEOCODER=nominatim` to fall back) and `/api/place-photo` (Wikimedia, CC-attributed, never on shared content)

## Run it

```bash
npm install
cp .env.example .env.local   # leave Supabase vars blank for guest-only mode
npm run dev
```

Sensors need **https** in the browser. For phone testing use a tunnel (ngrok), a Vercel preview, or `next dev --experimental-https`. For a full local stack with seeded data, see **[LOCAL_DEV.md](LOCAL_DEV.md)**.

## Configuration

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — leave blank for guest-only.
- `NEXT_PUBLIC_SITE_URL` — the public origin (auth redirects, OG). Defaults to `yonderful.app`.
- `GEOCODER` — `photon` (default) or `nominatim`.

## Honest constraints

- **No reliable background tracking** — web geolocation pauses when the tab backgrounds. A screen wake lock mitigates it; true pocket-tracking isn't possible from a browser.
- **Compass heading is optional** — the scope is heading-up; with no sensor it freezes orientation and prompts a calibrate rather than breaking.
- **Elevation is omitted on purpose** — GPS altitude is noisy, the barometer is unreachable from a browser, and it's a fitness metric we don't want.

## Docs

- **[CLAUDE.md](CLAUDE.md)** — the brand law (what it's for, what must never creep in). Read first.
- **[SCHEMA.md](SCHEMA.md)** — the object model (yonder · map · mission · post).
- **[PAYMENTS.md](PAYMENTS.md)** — Yonder+ / Stripe infra (built, currently ungated).
- **[LOCAL_DEV.md](LOCAL_DEV.md)** — local Supabase stack + seed data.
