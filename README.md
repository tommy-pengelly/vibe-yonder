# Vibe Yonder

A web app that does exactly three things:

1. **Search** any place by name or address.
2. **Walk to it by arrow** — a compass needle points at the destination as the crow flies, with distance remaining.
3. **Recap on arrival** — show the path you walked, distance, time, and pace.

No turn-by-turn, no map (yet), no database, no auth. Just sensors + math.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind v4
- [Nominatim](https://nominatim.openstreetmap.org/) for geocoding (proxied server-side)
- Browser Geolocation + DeviceOrientation APIs

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

## Roadmap (out of scope for MVP)

1. Wikipedia geosearch — destination blurb + "what's near me".
2. Drop-a-pin map picker (Leaflet + OSM tiles).
3. Dead-end / no-way-through warnings (Overpass / OSRM).
4. Accurate elevation (terrain lookup).
5. PWA + offline cache.
6. Pedestrian dead-reckoning for battery + sparse-GPS.
