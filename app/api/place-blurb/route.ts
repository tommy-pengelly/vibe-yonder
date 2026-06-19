import { NextResponse, type NextRequest } from "next/server";
import { haversine } from "@/lib/geo";

// A short Wikipedia blurb for a place (the text companion to /api/place-photo).
// Keyless, on-brand (CLAUDE.md anticipates "Wikipedia blurbs"). Feeds curiosity
// at a place, never navigation, and coverage is uneven by design.
//
// Same relevance rule as the photo route: match by the place's *identity*, not
// the nearest article. A blurb about the wrong place is worse than none.
//   1) `wiki` (the place's own Wikipedia title / Wikidata id) -> exact extract.
//   2) name -> article verified within 350m of the coords.
//   3) geosearch, name-match only (no nearest-article fallback).

const CONTACT = process.env.NOMINATIM_CONTACT ?? "tom.peng95@gmail.com";
const UA = `Yonderful/1.0 (${CONTACT})`;
const WEEK = 60 * 60 * 24 * 7;
const VERIFY_M = 350;

type Blurb = { title: string; extract: string; source: string };
type WikiPage = {
  title: string;
  extract?: string;
  coordinates?: Array<{ lat: number; lon: number }>;
};

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lat = parseFloat(sp.get("lat") ?? "");
  const lon = parseFloat(sp.get("lon") ?? "");
  const name = sp.get("name")?.trim() ?? "";
  const wikiRef = sp.get("wiki")?.trim() ?? "";
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json(null);
  }

  try {
    const blurb =
      (wikiRef ? await fromWikiRef(wikiRef) : null) ??
      (await fromNamed(lat, lon, name)) ??
      (await fromGeoNamed(lat, lon, name));
    return NextResponse.json(blurb ?? null);
  } catch {
    return NextResponse.json(null, { status: 502 });
  }
}

const api = (host: string, params: Record<string, string>) =>
  fetch(
    `https://${host}/w/api.php?` +
      new URLSearchParams({ format: "json", origin: "*", ...params }),
    { headers: { "User-Agent": UA }, next: { revalidate: WEEK } },
  );

const EXTRACT_PARAMS = {
  exintro: "1",
  explaintext: "1",
  exsentences: "3",
};

function pageToBlurb(p: WikiPage, host: string): Blurb | null {
  if (!p.extract?.trim()) return null;
  return {
    title: p.title,
    extract: p.extract.trim(),
    source: `https://${host}/wiki/${encodeURIComponent(p.title.replace(/ /g, "_"))}`,
  };
}

// 1) The place's own entity.
async function fromWikiRef(wiki: string): Promise<Blurb | null> {
  if (/^Q\d+$/i.test(wiki)) {
    const title = await enwikiTitle(wiki.toUpperCase());
    return title ? extractByTitle("en.wikipedia.org", title) : null;
  }
  const i = wiki.indexOf(":");
  const lang = i > 0 && i <= 3 ? wiki.slice(0, i) : "en";
  const title = i > 0 && i <= 3 ? wiki.slice(i + 1) : wiki;
  return extractByTitle(`${lang}.wikipedia.org`, title);
}

async function enwikiTitle(qid: string): Promise<string | null> {
  const res = await api("www.wikidata.org", {
    action: "wbgetentities",
    ids: qid,
    props: "sitelinks",
    sitefilter: "enwiki",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    entities?: Record<string, { sitelinks?: { enwiki?: { title?: string } } }>;
  };
  return data.entities?.[qid]?.sitelinks?.enwiki?.title ?? null;
}

async function extractByTitle(host: string, title: string): Promise<Blurb | null> {
  const res = await api(host, {
    action: "query",
    titles: title,
    redirects: "1",
    prop: "extracts",
    ...EXTRACT_PARAMS,
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    query?: { pages?: Record<string, WikiPage> };
  };
  const page = Object.values(data.query?.pages ?? {})[0];
  return page ? pageToBlurb(page, host) : null;
}

// 2) name -> article, verified near the coords.
async function fromNamed(lat: number, lon: number, name: string): Promise<Blurb | null> {
  if (!name) return null;
  const res = await api("en.wikipedia.org", {
    action: "query",
    generator: "search",
    gsrsearch: name,
    gsrnamespace: "0",
    gsrlimit: "8",
    prop: "extracts|coordinates",
    colimit: "8",
    ...EXTRACT_PARAMS,
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    query?: { pages?: Record<string, WikiPage> };
  };
  const pick = Object.values(data.query?.pages ?? {})
    // Name match AND proximity: search ranks the famous neighbour first, so a
    // statue beside the stadium must not inherit the stadium's blurb.
    .filter((p) => p.extract?.trim() && p.coordinates?.length && nameOverlap(p.title, name))
    .map((p) => ({ p, dist: haversine(lat, lon, p.coordinates![0].lat, p.coordinates![0].lon) }))
    .filter((c) => c.dist <= VERIFY_M)
    .sort((a, b) => a.dist - b.dist)[0]?.p;
  return pick ? pageToBlurb(pick, "en.wikipedia.org") : null;
}

// 3) geosearch, but only a genuine name match.
async function fromGeoNamed(lat: number, lon: number, name: string): Promise<Blurb | null> {
  if (!name) return null;
  const res = await api("en.wikipedia.org", {
    action: "query",
    generator: "geosearch",
    ggscoord: `${lat}|${lon}`,
    ggsradius: "1000",
    ggslimit: "8",
    prop: "extracts",
    ...EXTRACT_PARAMS,
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    query?: { pages?: Record<string, WikiPage> };
  };
  const pick = Object.values(data.query?.pages ?? {})
    .filter((p) => p.extract?.trim())
    .find((p) => nameOverlap(p.title, name));
  return pick ? pageToBlurb(pick, "en.wikipedia.org") : null;
}

const STOP = new Set([
  "the", "a", "an", "of", "and", "cafe", "café", "coffee", "bar", "pub",
  "restaurant", "shop", "store", "house", "st", "saint", "club", "hotel",
]);
function nameOverlap(a: string, b: string): boolean {
  const toks = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 3 && !STOP.has(w));
  const tb = new Set(toks(b));
  return toks(a).some((w) => tb.has(w));
}
