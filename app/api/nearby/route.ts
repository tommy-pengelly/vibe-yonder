import { NextResponse, type NextRequest } from "next/server";
import { categoryByKey, type NearbyPlace } from "@/lib/nearby";

// Vibe Yonder's third server route: "places of type X near a point", for
// category search ("find me a café") and sidequests. Keyless, OSM via Overpass
// — env-swappable to a managed provider later (NEARBY_PROVIDER). Coverage is
// uneven by design; returns [] gracefully. Results are for *wandering toward*,
// never a nearest-amenity finder, so we shuffle-ish by distance bands rather
// than strictly nearest-first (see ordering below).

const CONTACT = process.env.NOMINATIM_CONTACT ?? "tom.peng95@gmail.com";
// A couple of community endpoints; we try them in order (the main one 504s when
// busy). Self-host/managed later via env.
const OVERPASS_ENDPOINTS = (
  process.env.OVERPASS_URL ??
  "https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter"
).split(",");

function haversine(aLat: number, aLon: number, bLat: number, bLon: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lat = parseFloat(sp.get("lat") ?? "");
  const lon = parseFloat(sp.get("lon") ?? "");
  const cat = categoryByKey(sp.get("category") ?? "");
  const radius = Math.min(
    Math.max(parseInt(sp.get("radius") ?? "1500", 10) || 1500, 100),
    5000,
  );
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !cat) {
    return NextResponse.json([]);
  }

  // Build an Overpass union over node+way for each tag selector.
  const sel = cat.filters
    .flatMap((f) => [
      `node[${f}](around:${radius},${lat},${lon});`,
      `way[${f}](around:${radius},${lat},${lon});`,
    ])
    .join("");
  const query = `[out:json][timeout:20];(${sel});out center 40;`;

  try {
    const data = await runOverpass(query);
    const seen = new Set<string>();
    const places: NearbyPlace[] = [];
    for (const el of data.elements ?? []) {
      const name = el.tags?.name;
      if (!name) continue; // unnamed → not worth pointing at
      const plat = el.lat ?? el.center?.lat;
      const plon = el.lon ?? el.center?.lon;
      if (plat == null || plon == null) continue;
      const k = name.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      places.push({
        name,
        lat: plat,
        lon: plon,
        category: cat.key,
        dist: Math.round(haversine(lat, lon, plat, plon)),
      });
    }
    // Wander-toward ordering: nearest-first but not laser-optimised — keep the
    // closest handful, then a few from further out for a sense of adventure.
    places.sort((a, b) => (a.dist ?? 0) - (b.dist ?? 0));
    const near = places.slice(0, 5);
    const far = places.slice(5).slice(0, 4);
    return NextResponse.json([...near, ...far]);
  } catch {
    return NextResponse.json([], { status: 502 });
  }
}

type OverpassEl = {
  tags?: { name?: string };
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
};

async function runOverpass(
  query: string,
): Promise<{ elements?: OverpassEl[] }> {
  let lastErr: unknown;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": `VibeYonder/1.0 (${CONTACT})`,
        },
        body: `data=${encodeURIComponent(query)}`,
        next: { revalidate: 60 * 60 * 6 },
      });
      if (!res.ok) {
        lastErr = new Error(`overpass ${res.status}`);
        continue;
      }
      return (await res.json()) as { elements?: OverpassEl[] };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("overpass unreachable");
}
