# Vibe Yonder

> Strava for exploring.

Pick a place, walk toward an arrow on a you-centred minimap — no turn-by-turn route, you choose the streets — and get a recap that celebrates how much you **yondered** (walked ÷ direct distance), not how fast you went.

## What's in the box

- **Search** any place (Nominatim-backed, ranked by importance + proximity, with `X away` distance labels)
- **Walk** screen: canvas minimap with a fading trail, destination arrow on the rim, ghost arrows for nearby POIs, live time / distance / pace, pause-resume-finish, screen wake lock while moving, and a quiet "Just take me there ↗" deep-link to Apple / Google Maps walking directions
- **Recap** screen: trace with the same soft fade-mask, `Yondered` hero number, and the rest of the stats (Walked, Time, Direct, Pace)
- **Journeys**: build an ordered chain of waypoints; advance manually on each arrival; survives a refresh via `localStorage`
- **Explain** page explaining what every stat means, including the philosophy of `Yondered`

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind v4
- [Nominatim](https://nominatim.openstreetmap.org/) for geocoding (proxied server-side)
- Browser Geolocation + DeviceOrientation + Screen Wake Lock APIs

No database, no auth, no API keys, nothing paid.

## Run it

```bash
npm install
npm run dev
```

Sensors require **https** in the browser. For local testing on a phone, use Vercel preview, `next dev --experimental-https`, or a tunnel like ngrok.

## Configuration

- `NOMINATIM_CONTACT` (optional) — contact string baked into the `User-Agent` header sent to Nominatim. Their usage policy [requires](https://operations.osmfoundation.org/policies/nominatim/) an identifying UA; defaults to a placeholder you should change before serious use.

## Deploy

Push to GitHub, import to Vercel, no env vars required. Vercel provides https automatically (which the device sensors need).

## Honest constraints

- **No reliable background tracking** — web geolocation pauses when the tab is backgrounded. The app holds a screen wake lock during a walk to mitigate. Pocket-tracking isn't possible from a browser.
- **Compass heading is optional** — the minimap defaults to **north-up**. Heading-up is a toggle that falls back gracefully when no sensor is available.
- **Elevation is omitted** — GPS altitude is too noisy and the barometer isn't reachable from a browser.

## Roadmap

- Auto-discovered POIs + Wikipedia blurbs for ghost arrows
- Dead-end / no-way-through warnings (OSM pedestrian graph)
- Real OSM tiles under the trail (optional skin)
- Shareable recap image + walk history
- PWA / offline / installable
