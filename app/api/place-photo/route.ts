import { NextResponse, type NextRequest } from "next/server";
import { haversine } from "@/lib/geo";
import type { PlacePhotoData } from "@/lib/types";

// Resolve a photo for a place from Wikimedia, keyless, on-brand (CLAUDE.md
// anticipates "Wikipedia blurbs"). Photos feed curiosity, never navigation, so
// coverage is uneven by design: famous places resolve, a random corner returns
// null and the UI shows nothing.
//
// The hard part is RELEVANCE: a photo of the wrong place is worse than none. So
// we match by the place's *identity*, not by "nearest photo to a lat/lon"
// (which returned trees and signs). Resolution order, strict-first:
//   1) `wiki` — the place's own Wikipedia title / Wikidata id (from OSM tags).
//      An exact entity match. Best when we have it.
//   2) name -> Wikipedia article, VERIFIED to sit near the coords. Identity
//      match (the name) with a location guard so a café query can't borrow a
//      church's photo.
//   3) Wikipedia geosearch, but only a genuine name match (no nearest-article
//      fallback, the old mismatch source).
//   4) a tight Commons geosearch (a photo essentially AT the spot) as a faint
//      last resort. Far smaller radius than before so it can't wander.
// Attribution is always returned, required by the CC licences, and shown.

const CONTACT = process.env.NOMINATIM_CONTACT ?? "tom.peng95@gmail.com";
const UA = `Yonderful/1.0 (${CONTACT})`;
const WEEK = 60 * 60 * 24 * 7;

// How far a Wikipedia article may sit from the place and still be "it".
const VERIFY_M = 350;
// Last-resort Commons radius: only a photo basically on top of the spot.
const COMMONS_M = 60;

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
    const photo =
      (wikiRef ? await fromWikiRef(wikiRef) : null) ??
      (await fromWikipediaNamed(lat, lon, name)) ??
      (await fromWikipediaGeoNamed(lat, lon, name)) ??
      (await fromCommonsNearby(lat, lon));
    return NextResponse.json(photo ?? null);
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

// === 1) The place's own entity (OSM wikipedia / wikidata tag) ==============
// `wiki` is either a Wikidata id ("Q9696") or a Wikipedia title, optionally
// language-prefixed ("en:Emirates Stadium").
async function fromWikiRef(wiki: string): Promise<PlacePhotoData | null> {
  if (/^Q\d+$/i.test(wiki)) return fromWikidata(wiki.toUpperCase());
  const i = wiki.indexOf(":");
  const lang = i > 0 && i <= 3 ? wiki.slice(0, i) : "en";
  const title = i > 0 && i <= 3 ? wiki.slice(i + 1) : wiki;
  return fromWikipediaTitle(`${lang}.wikipedia.org`, title);
}

async function fromWikidata(qid: string): Promise<PlacePhotoData | null> {
  const res = await api("www.wikidata.org", {
    action: "wbgetentities",
    ids: qid,
    props: "claims",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    entities?: Record<
      string,
      { claims?: { P18?: Array<{ mainsnak?: { datavalue?: { value?: string } } }> } }
    >;
  };
  const file = data.entities?.[qid]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
  return file ? commonsThumb(file) : null;
}

async function fromWikipediaTitle(
  host: string,
  title: string,
): Promise<PlacePhotoData | null> {
  const res = await api(host, {
    action: "query",
    titles: title,
    prop: "pageimages",
    piprop: "thumbnail|name",
    pithumbsize: "800",
    redirects: "1",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    query?: { pages?: Record<string, WikiPage> };
  };
  const page = Object.values(data.query?.pages ?? {})[0];
  return page ? pageToPhoto(page, host) : null;
}

// === 2) name -> Wikipedia article, verified near the coords =================
type WikiPage = {
  index?: number;
  title: string;
  pageimage?: string;
  thumbnail?: { source: string; width: number; height: number };
  coordinates?: Array<{ lat: number; lon: number }>;
};

async function fromWikipediaNamed(
  lat: number,
  lon: number,
  name: string,
): Promise<PlacePhotoData | null> {
  if (!name) return null;
  const res = await api("en.wikipedia.org", {
    action: "query",
    generator: "search",
    gsrsearch: name,
    gsrnamespace: "0",
    gsrlimit: "8",
    prop: "pageimages|coordinates",
    piprop: "thumbnail|name",
    pithumbsize: "800",
    colimit: "8",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    query?: { pages?: Record<string, WikiPage> };
  };
  const candidates = Object.values(data.query?.pages ?? {})
    .filter((p) => p.thumbnail?.source && p.coordinates?.length)
    .map((p) => ({
      p,
      dist: haversine(lat, lon, p.coordinates![0].lat, p.coordinates![0].lon),
    }))
    .filter((c) => c.dist <= VERIFY_M)
    .sort((a, b) => a.dist - b.dist);
  const pick = candidates[0]?.p;
  return pick ? pageToPhoto(pick, "en.wikipedia.org") : null;
}

// === 3) geosearch, but only a genuine name match ============================
async function fromWikipediaGeoNamed(
  lat: number,
  lon: number,
  name: string,
): Promise<PlacePhotoData | null> {
  if (!name) return null;
  const res = await api("en.wikipedia.org", {
    action: "query",
    prop: "pageimages",
    piprop: "thumbnail|name",
    pithumbsize: "800",
    generator: "geosearch",
    ggscoord: `${lat}|${lon}`,
    ggsradius: "1000",
    ggslimit: "10",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    query?: { pages?: Record<string, WikiPage> };
  };
  const pages = Object.values(data.query?.pages ?? {}).filter(
    (p) => p.thumbnail?.source,
  );
  // No nearest-article fallback: it must share a meaningful word with the name.
  const pick = pages.find((p) => nameOverlap(p.title, name));
  return pick ? pageToPhoto(pick, "en.wikipedia.org") : null;
}

// === 4) tight Commons geosearch (last resort) ===============================
type CommonsFile = {
  index: number;
  title: string;
  imageinfo?: Array<{
    thumburl?: string;
    thumbwidth?: number;
    thumbheight?: number;
    descriptionurl?: string;
    mime?: string;
    extmetadata?: Record<string, { value?: string }>;
  }>;
};

async function fromCommonsNearby(
  lat: number,
  lon: number,
): Promise<PlacePhotoData | null> {
  const res = await api("commons.wikimedia.org", {
    action: "query",
    prop: "imageinfo",
    iiprop: "url|extmetadata|mime",
    iiurlwidth: "800",
    generator: "geosearch",
    ggsnamespace: "6",
    ggscoord: `${lat}|${lon}`,
    ggsradius: String(COMMONS_M),
    ggslimit: "15",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    query?: { pages?: Record<string, CommonsFile> };
  };
  const files = Object.values(data.query?.pages ?? {})
    .filter((f) => {
      const ii = f.imageinfo?.[0];
      return ii?.thumburl && /^image\/(jpe?g|png|webp)$/.test(ii.mime ?? "");
    })
    .sort((a, b) => a.index - b.index);
  const pick = files[0];
  const ii = pick?.imageinfo?.[0];
  if (!pick || !ii?.thumburl) return null;

  const meta = ii.extmetadata ?? {};
  return {
    url: ii.thumburl,
    width: ii.thumbwidth,
    height: ii.thumbheight,
    title: pick.title.replace(/^File:/, "").replace(/\.[a-z]+$/i, ""),
    author: stripHtml(meta.Artist?.value),
    license: meta.LicenseShortName?.value,
    source: ii.descriptionurl ?? "https://commons.wikimedia.org",
  };
}

// === shared helpers =========================================================

// A Wikipedia page (with a pageimages thumbnail) -> PlacePhotoData, with
// attribution looked up from the underlying Commons file.
async function pageToPhoto(
  page: WikiPage,
  host: string,
): Promise<PlacePhotoData | null> {
  const thumb = page.thumbnail;
  if (!thumb?.source) return null;
  const attr = page.pageimage ? await fileAttribution(page.pageimage) : null;
  return {
    url: thumb.source,
    width: thumb.width,
    height: thumb.height,
    title: page.title,
    author: attr?.author,
    license: attr?.license,
    source:
      attr?.source ??
      `https://${host}/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
  };
}

// A Commons file name ("Emirates Stadium.jpg") -> a thumbnail + attribution.
async function commonsThumb(fileName: string): Promise<PlacePhotoData | null> {
  const res = await api("commons.wikimedia.org", {
    action: "query",
    titles: `File:${fileName}`,
    prop: "imageinfo",
    iiprop: "url|extmetadata|mime",
    iiurlwidth: "800",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    query?: { pages?: Record<string, CommonsFile> };
  };
  const pick = Object.values(data.query?.pages ?? {})[0];
  const ii = pick?.imageinfo?.[0];
  if (!ii?.thumburl) return null;
  const meta = ii.extmetadata ?? {};
  return {
    url: ii.thumburl,
    width: ii.thumbwidth,
    height: ii.thumbheight,
    title: fileName.replace(/\.[a-z]+$/i, ""),
    author: stripHtml(meta.Artist?.value),
    license: meta.LicenseShortName?.value,
    source:
      ii.descriptionurl ??
      `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileName)}`,
  };
}

// --- Attribution lookup for a Commons file by name ------------------------
async function fileAttribution(
  fileName: string,
): Promise<{ author?: string; license?: string; source?: string } | null> {
  const res = await api("commons.wikimedia.org", {
    action: "query",
    prop: "imageinfo",
    iiprop: "extmetadata|url",
    titles: `File:${fileName}`,
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          imageinfo?: Array<{
            descriptionurl?: string;
            extmetadata?: Record<string, { value?: string }>;
          }>;
        }
      >;
    };
  };
  const ii = Object.values(data.query?.pages ?? {})[0]?.imageinfo?.[0];
  if (!ii) return null;
  const meta = ii.extmetadata ?? {};
  return {
    author: stripHtml(meta.Artist?.value),
    license: meta.LicenseShortName?.value,
    source: ii.descriptionurl,
  };
}

// Two place names "match" if they share a meaningful word. Drops generic words
// (café, the, pub…) so "Blue Bottle Coffee" still matches "Blue Bottle" but
// "The Crown" doesn't grab every "Crown Court" in town.
const STOP = new Set([
  "the", "a", "an", "of", "and", "cafe", "café", "coffee", "bar", "pub",
  "restaurant", "shop", "store", "house", "st", "saint", "club", "hotel",
]);
function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP.has(w));
}
function nameOverlap(a: string, b: string): boolean {
  const ta = tokens(a);
  const tb = new Set(tokens(b));
  return ta.some((w) => tb.has(w));
}

/** Commons author fields are HTML; flatten to plain text for the caption. */
function stripHtml(html?: string): string | undefined {
  if (!html) return undefined;
  const text = html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length ? text.slice(0, 120) : undefined;
}
