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
    const results =
      PROVIDER === "nominatim"
        ? await viaNominatim(q, near)
        : await viaPhoton(q, near);
    return NextResponse.json(results);
  } catch {
    return NextResponse.json([], { status: 502 });
  }
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
    `https://photon.komoot.io/api?limit=6&q=${encodeURIComponent(q)}`;
  if (near) url += `&lat=${near.lat}&lon=${near.lon}`;

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
