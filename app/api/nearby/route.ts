import { NextResponse, type NextRequest } from "next/server";
import {
  categoryByKey,
  CURIO_QIDS,
  INTERESTING_FILTERS,
  NEARBY_RINGS,
  type NearbyPlace,
  themeByKey,
} from "@/lib/nearby";

// Yonderful's third server route: "places of type X near a point", for
// category search ("find me a café") and sidequests. Keyless, OSM via Overpass
//, env-swappable to a managed provider later (NEARBY_PROVIDER). Coverage is
// uneven by design; returns [] gracefully. Results are for *wandering toward*,
// never a nearest-amenity finder, so we shuffle-ish by distance bands rather
// than strictly nearest-first (see ordering below).
//
// Two shapes share this route:
//  - default      `?category=&lat=&lon=&radius=`  → one category in one radius
//                 (sidequests, category search). Unchanged behaviour.
//  - `?scope=ambient` → the Doc 7 ring stack: the active category up close, then
//                 anything *interesting*, then only the *notable* far out. Each
//                 place carries a `klass` + stable `id` so the client engine can
//                 score it.

const CONTACT = process.env.NOMINATIM_CONTACT ?? "tom.peng95@gmail.com";
const UA = `Yonderful/1.0 (${CONTACT})`;
const SIX_H = 60 * 60 * 6;
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

type OverpassEl = {
  type?: string;
  id?: number;
  tags?: {
    name?: string;
    wikipedia?: string;
    wikidata?: string;
    tourism?: string;
    historic?: string;
    leisure?: string;
    natural?: string;
    waterway?: string;
    /** Settlement/locality label (city/town/suburb), not a wander destination. */
    place?: string;
    brand?: string;
    "brand:wikidata"?: string;
  };
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
};

/** Infer a display category + ring class from an element's tags (ambient rings,
 * where a place may have matched the interesting/wiki clauses rather than the
 * requested category). Falls back to the asked-for category. */
function classify(
  tags: NonNullable<OverpassEl["tags"]>,
  fallbackCat: string,
): { klass: "any" | "interesting"; category: string } {
  if (tags.tourism === "viewpoint") return { klass: "interesting", category: "viewpoint" };
  if (tags.tourism === "artwork" || tags.tourism === "gallery")
    return { klass: "interesting", category: "art" };
  if (tags.tourism === "museum" || tags.historic)
    return { klass: "interesting", category: "history" };
  if (tags.leisure === "park") return { klass: "interesting", category: "park" };
  if (tags.leisure === "garden") return { klass: "interesting", category: "garden" };
  if (tags.natural === "water" || tags.waterway)
    return { klass: "interesting", category: "water" };
  return { klass: "any", category: fallbackCat };
}

function toPlace(
  el: OverpassEl,
  originLat: number,
  originLon: number,
  fallbackCat: string,
  ambient: boolean,
): NearbyPlace | null {
  const name = el.tags?.name;
  if (!name) return null; // unnamed → not worth pointing at
  if (el.tags?.place) return null; // a settlement/locality label, not a place to visit
  const plat = el.lat ?? el.center?.lat;
  const plon = el.lon ?? el.center?.lon;
  if (plat == null || plon == null) return null;
  const dist = Math.round(haversine(originLat, originLon, plat, plon));
  const wiki = el.tags?.wikipedia ?? el.tags?.wikidata;
  const id = el.type && el.id != null ? `${el.type}/${el.id}` : undefined;
  const chain = !!(el.tags?.brand || el.tags?.["brand:wikidata"]);
  if (!ambient) {
    return { name, lat: plat, lon: plon, category: fallbackCat, dist, wiki, id, chain };
  }
  const { klass, category } = classify(el.tags ?? {}, fallbackCat);
  return {
    name,
    lat: plat,
    lon: plon,
    category,
    dist,
    wiki,
    id,
    chain,
    // A place with a wiki entry beyond the interesting ring is "notable"; close
    // in it keeps its tag-derived class (wiki still lifts its score either way).
    klass: wiki && dist > NEARBY_RINGS.interesting ? "notable" : klass,
  };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lat = parseFloat(sp.get("lat") ?? "");
  const lon = parseFloat(sp.get("lon") ?? "");
  const ambient = sp.get("scope") === "ambient";
  const cat = categoryByKey(sp.get("category") ?? "");
  // A theme (e.g. "art", "history") drives BOTH layers: its OSM filters for the
  // everyday ring and its Wikidata QIDs for the notable ring. No theme ⇒ the
  // broad curio set.
  const theme = themeByKey(sp.get("theme") ?? "");
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json([]);
  }
  // Default path still requires a category; ambient can run guide/theme-less.
  if (!ambient && !cat) return NextResponse.json([]);

  const ambientFilters = theme?.filters ?? cat?.filters ?? [];
  const query = ambient
    ? ambientQuery(lat, lon, ambientFilters)
    : defaultQuery(lat, lon, cat!.filters, clampRadius(sp.get("radius")));

  // Kick the notable (Wikidata) layer off in parallel with Overpass so the
  // ambient round-trip is max(overpass, wikidata), not their sum. wikidataCurios
  // swallows its own errors (returns []), so this never rejects.
  const wdPromise = ambient
    ? wikidataCurios(lat, lon, NEARBY_RINGS.notable / 1000, theme?.qids ?? CURIO_QIDS)
    : null;

  try {
    const data = await runOverpass(query);
    const seenId = new Set<string>();
    const seenName = new Set<string>();
    const places: NearbyPlace[] = [];
    for (const el of data.elements ?? []) {
      const p = toPlace(el, lat, lon, cat?.key ?? "", ambient);
      if (!p) continue;
      if (p.id && seenId.has(p.id)) continue;
      const nk = p.name.toLowerCase();
      if (seenName.has(nk)) continue;
      if (p.id) seenId.add(p.id);
      seenName.add(nk);
      places.push(p);
    }
    places.sort((a, b) => (a.dist ?? 0) - (b.dist ?? 0));

    if (ambient) {
      // Federate the notable layer: typed curios from Wikidata, ranked by
      // sitelinks. Enrich an OSM place that already carries the same Qid (so it
      // gains a notability count), else add it.
      const wd = (await wdPromise) ?? [];
      const byQid = new Map(
        places.filter((p) => p.wiki && /^Q\d+$/.test(p.wiki)).map((p) => [p.wiki!, p]),
      );
      for (const w of wd) {
        const ex = w.wiki ? byQid.get(w.wiki) : undefined;
        if (ex) {
          ex.sitelinks = w.sitelinks;
          ex.typeLabel = w.typeLabel;
          ex.klass = "notable";
        } else {
          places.push(w);
        }
      }
      places.sort((a, b) => (a.dist ?? 0) - (b.dist ?? 0));
      // Keep a bounded, varied pool, the client's score()/rankCandidates does
      // the real gating. Never drop the notable far ones in favour of near
      // clutter, so partition: nearest notable + nearest everyday.
      const notable = places.filter((p) => p.wiki).slice(0, 12);
      const rest = places.filter((p) => !p.wiki).slice(0, 8);
      return NextResponse.json([...rest, ...notable]);
    }

    // Default wander-toward ordering: closest handful, then a few from further
    // out for a sense of adventure.
    const near = places.slice(0, 5);
    const far = places.slice(5).slice(0, 4);
    return NextResponse.json([...near, ...far]);
  } catch {
    return NextResponse.json([], { status: 502 });
  }
}

function clampRadius(raw: string | null): number {
  return Math.min(Math.max(parseInt(raw ?? "1500", 10) || 1500, 100), 5000);
}

/** One category, one radius, node+way union. */
function defaultQuery(lat: number, lon: number, filters: string[], radius: number) {
  const sel = filters
    .flatMap((f) => [
      `node[${f}](around:${radius},${lat},${lon});`,
      `way[${f}](around:${radius},${lat},${lon});`,
    ])
    .join("");
  return `[out:json][timeout:20];(${sel});out center 40;`;
}

/** The ambient ring stack: category@400 · interesting@1200 · wiki@3000. One
 * round-trip, but each ring gets its **own `out` budget** so a dense outer ring
 * (central cities have hundreds of wiki nodes) can't truncate the near rings
 * away. This is the per-ring cap from Doc 7 Part B, enforced at the source. */
function ambientQuery(lat: number, lon: number, catFilters: string[]) {
  const ringSet = (filters: string[], r: number) =>
    "(" +
    filters
      .flatMap((f) => [
        `node[${f}](around:${r},${lat},${lon});`,
        `way[${f}](around:${r},${lat},${lon});`,
      ])
      .join("") +
    ")";
  const parts: string[] = [];
  if (catFilters.length)
    parts.push(`${ringSet(catFilters, NEARBY_RINGS.any)};out center 20;`);
  parts.push(`${ringSet(INTERESTING_FILTERS, NEARBY_RINGS.interesting)};out center 30;`);
  // Ring 2 is keyed on `wikipedia` only (not `wikidata`): a Wikipedia article is
  // a selective "notable" signal, whereas wikidata blankets every junction and
  // locality and would flood dense areas. wikidata is still read as a notability
  // hint when a near place happens to carry it.
  parts.push(`${ringSet(['"wikipedia"'], NEARBY_RINGS.notable)};out center 30;`);
  return `[out:json][timeout:25];${parts.join("")}`;
}

// The *notable* layer: typed curios near a point, ranked by encyclopedic
// notability (sitelink count), via Wikidata's geospatial SPARQL service. Direct
// P31 against a QID set (transitive P279* times out on the public endpoint).
// Coordinate-free notability, keyless, cached. Returns [] on any failure so the
// route degrades to OSM-only.
type WdBinding = {
  item: { value: string };
  itemLabel?: { value: string };
  coord?: { value: string };
  dist?: { value: string };
  sitelinks?: { value: string };
  typeLabel?: { value: string };
};

async function wikidataCurios(
  lat: number,
  lon: number,
  radiusKm: number,
  qids: string[],
): Promise<NearbyPlace[]> {
  if (!qids.length) return [];
  const values = qids.map((q) => `wd:${q}`).join(" ");
  const query =
    `SELECT ?item ?itemLabel ?coord ?dist ?sitelinks ?typeLabel WHERE {` +
    `SERVICE wikibase:around { ?item wdt:P625 ?coord. ` +
    `bd:serviceParam wikibase:center "Point(${lon} ${lat})"^^geo:wktLiteral. ` +
    `bd:serviceParam wikibase:radius "${radiusKm}". bd:serviceParam wikibase:distance ?dist. } ` +
    `VALUES ?type { ${values} } ?item wdt:P31 ?type. ?item wikibase:sitelinks ?sitelinks. ` +
    `SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } ` +
    `ORDER BY DESC(?sitelinks) LIMIT 40`;
  try {
    const res = await fetch(
      `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`,
      {
        headers: { "User-Agent": UA, Accept: "application/sparql-results+json" },
        next: { revalidate: SIX_H },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: { bindings?: WdBinding[] } };
    const out: NearbyPlace[] = [];
    for (const b of data.results?.bindings ?? []) {
      const qid = b.item.value.split("/").pop() ?? "";
      const name = b.itemLabel?.value;
      if (!name || name === qid) continue; // no English label ⇒ skip
      const m = b.coord?.value.match(/Point\(([-\d.]+) ([-\d.]+)\)/);
      if (!m) continue;
      out.push({
        name,
        lat: parseFloat(m[2]),
        lon: parseFloat(m[1]),
        category: "",
        dist: b.dist ? Math.round(parseFloat(b.dist.value) * 1000) : undefined,
        wiki: qid,
        sitelinks: b.sitelinks ? parseInt(b.sitelinks.value, 10) : undefined,
        typeLabel: b.typeLabel?.value,
        klass: "notable",
        id: `wd/${qid}`,
      });
    }
    return out;
  } catch {
    return [];
  }
}

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
          "User-Agent": `Yonderful/1.0 (${CONTACT})`,
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
