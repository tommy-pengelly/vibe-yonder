import { NextResponse, type NextRequest } from "next/server";

// Yonderful's one server route: turn typed text into coordinates.
// Provider is swappable via GEOCODER env (photon | nominatim). Photon is the
// default, it's built for search-as-you-type and biases results toward the
// user's location, which is exactly right for a local-wander app.
type GeocodeResult = {
  name: string;
  label: string;
  lat: number;
  lon: number;
  importance: number;
};

const PROVIDER = (process.env.GEOCODER ?? "photon").toLowerCase();
const CONTACT = process.env.NOMINATIM_CONTACT ?? "tom.peng95@gmail.com";
const OVERPASS_ENDPOINTS = (
  process.env.OVERPASS_URL ??
  "https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter"
).split(",");

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim();
  if (!q || q.length < 3) return NextResponse.json([]);

  // Optional proximity bias, the dot's current position, when we have it.
  const lat = parseFloat(sp.get("lat") ?? "");
  const lon = parseFloat(sp.get("lon") ?? "");
  const near =
    Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;

  try {
    if (PROVIDER === "nominatim") {
      return NextResponse.json(await viaNominatim(q, near));
    }
    // Photon (a geocoder) ranks by name-importance, so "tesco" returns the
    // distant exact-name supermarkets, not the Tesco Express by your side. When
    // we have a location, blend in a nearby OSM name/brand search (Overpass) so
    // the close match is in the candidate set; the client's proximity ranking
    // then floats it to the top. Run in parallel so one slow source can't sink
    // the other.
    const [photon, overpass] = await Promise.allSettled([
      viaPhoton(q, near),
      near ? viaOverpassNearby(q, near) : Promise.resolve<GeocodeResult[]>([]),
    ]);
    const photonRes = photon.status === "fulfilled" ? photon.value : [];
    const nearbyRes = overpass.status === "fulfilled" ? overpass.value : [];
    if (photon.status === "rejected" && nearbyRes.length === 0) {
      return NextResponse.json([], { status: 502 });
    }
    // Nearby (real, close) first; drop Photon hits that are the same spot.
    return NextResponse.json(mergeResults(nearbyRes, photonRes));
  } catch {
    return NextResponse.json([], { status: 502 });
  }
}

// Merge two result lists, dropping entries from `secondary` that sit on top of
// a `primary` one (~40 m), so a nearby OSM hit and Photon's distant namesake
// don't both clutter the list.
function mergeResults(
  primary: GeocodeResult[],
  secondary: GeocodeResult[],
): GeocodeResult[] {
  const same = (a: GeocodeResult, b: GeocodeResult) =>
    Math.abs(a.lat - b.lat) < 0.0004 && Math.abs(a.lon - b.lon) < 0.0004;
  return [...primary, ...secondary.filter((s) => !primary.some((p) => same(p, s)))];
}

// A nearby OSM POI search by name/brand (the "which Tesco is by me" question
// Photon can't answer). Matches name OR brand within ~3 km; importance is left
// modest so the client's proximity weighting decides the order. Aborts at 6s
// and tries a backup endpoint, so it never hangs search-as-you-type.
type OverpassEl = {
  tags?: Record<string, string>;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
};

async function viaOverpassNearby(
  q: string,
  near: { lat: number; lon: number },
): Promise<GeocodeResult[]> {
  const term = q.replace(/[^a-z0-9 ]/gi, " ").trim();
  if (term.length < 2) return [];
  // Case-insensitive WITHOUT the `,i` flag (it returns nothing on the public
  // endpoint): turn each letter into a [lU] class. Term is pre-sanitised to
  // [a-z0-9 ], so there's nothing else to escape. Match name OR brand within r m.
  const ci = term
    .split("")
    .map((c) => (/[a-z]/i.test(c) ? `[${c.toLowerCase()}${c.toUpperCase()}]` : c))
    .join("");
  const r = 3000;
  const around = `(around:${r},${near.lat},${near.lon})`;
  const query =
    `[out:json][timeout:15];` +
    `(nwr["name"~"${ci}"]${around};nwr["brand"~"${ci}"]${around););` +
    `out center 40;`;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": `Yonderful/1.0 (${CONTACT})`,
        },
        body: `data=${encodeURIComponent(query)}`,
        next: { revalidate: 60 * 60 * 6 },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { elements?: OverpassEl[] };
      const seen = new Set<string>();
      const out: GeocodeResult[] = [];
      for (const el of data.elements ?? []) {
        const name = el.tags?.name;
        const plat = el.lat ?? el.center?.lat;
        const plon = el.lon ?? el.center?.lon;
        if (!name || plat == null || plon == null) continue;
        const key = `${name.toLowerCase()}@${plat.toFixed(4)},${plon.toFixed(4)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const parts = [
          name,
          el.tags?.["addr:street"],
          el.tags?.["addr:suburb"] ?? el.tags?.["addr:city"],
        ].filter(Boolean);
        out.push({
          name,
          label: Array.from(new Set(parts)).join(", ") || name,
          lat: plat,
          lon: plon,
          importance: 0.5,
        });
      }
      return out;
    } catch {
      // try the next endpoint (or give up, Photon still answers)
    }
  }
  return [];
}

// --- Photon (komoot), default. Keyless, OSM-based, proximity-aware. -------
type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    osm_value?: string;
  };
};

async function viaPhoton(
  q: string,
  near: { lat: number; lon: number } | null,
): Promise<GeocodeResult[]> {
  let url =
    `https://photon.komoot.io/api?limit=10&q=${encodeURIComponent(q)}`;
  // location_bias_scale pulls nearby hits up (Photon's default bias is weak).
  if (near) url += `&lat=${near.lat}&lon=${near.lon}&location_bias_scale=0.6`;

  const res = await fetch(url, {
    headers: { "User-Agent": `Yonderful/1.0 (${CONTACT})` },
    next: { revalidate: 60 * 60 * 24 },
  });
  if (!res.ok) throw new Error("photon");

  const data = (await res.json()) as { features?: PhotonFeature[] };
  const feats = data.features ?? [];

  return feats.map((f, i) => {
    const p = f.properties;
    const [flon, flat] = f.geometry.coordinates;
    const street = [p.housenumber, p.street].filter(Boolean).join(" ");
    const parts = [
      p.name,
      street,
      p.district,
      p.city ?? p.county,
      p.state,
      p.country,
    ].filter(Boolean);
    return {
      name: p.name || street || parts[0] || q,
      label: Array.from(new Set(parts)).join(", "),
      lat: flat,
      lon: flon,
      // Photon returns best-first; synthesise a descending importance so the
      // client's blended (importance + proximity) ranking stays meaningful.
      importance: feats.length ? (feats.length - i) / feats.length : 0,
    };
  });
}

// --- Nominatim, fallback. Set GEOCODER=nominatim to use the OSM server. ---
type NominatimResult = {
  name?: string;
  display_name: string;
  lat: string;
  lon: string;
  importance?: number;
};

async function viaNominatim(
  q: string,
  near: { lat: number; lon: number } | null,
): Promise<GeocodeResult[]> {
  let url =
    `https://nominatim.openstreetmap.org/search` +
    `?format=jsonv2&limit=6&addressdetails=0&q=${encodeURIComponent(q)}`;
  if (near) {
    // Bias toward a ~0.5° box around the dot without hard-excluding far hits.
    const d = 0.35;
    url +=
      `&viewbox=${near.lon - d},${near.lat + d},${near.lon + d},${near.lat - d}` +
      `&bounded=0`;
  }

  const res = await fetch(url, {
    headers: {
      "User-Agent": `Yonderful/1.0 (${CONTACT})`,
      Accept: "application/json",
    },
    next: { revalidate: 60 * 60 * 24 },
  });
  if (!res.ok) throw new Error("nominatim");

  const raw = (await res.json()) as NominatimResult[];
  return raw.map((r) => ({
    name: r.name || String(r.display_name).split(",")[0],
    label: r.display_name,
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
    importance: r.importance ?? 0,
  }));
}
