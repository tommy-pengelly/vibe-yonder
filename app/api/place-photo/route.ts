import { NextResponse, type NextRequest } from "next/server";
import type { PlacePhotoData } from "@/lib/types";

// Resolve a photo for a place from Wikimedia — keyless, on-brand (CLAUDE.md
// anticipates "Wikipedia blurbs"). Photos feed curiosity, never navigation, so
// coverage is uneven by design: famous places resolve, a random corner returns
// null and the UI shows nothing. Two strategies, best-relevance first:
//   A) the lead image of a Wikipedia article near the coords (high relevance)
//   B) any geotagged photo on Commons near the coords (broad coverage)
// Attribution is always returned — required by the CC licences, and you're
// monetising, so it must be displayed.

const CONTACT = process.env.NOMINATIM_CONTACT ?? "tom.peng95@gmail.com";
const UA = `VibeYonder/1.0 (${CONTACT})`;
const WEEK = 60 * 60 * 24 * 7;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lat = parseFloat(sp.get("lat") ?? "");
  const lon = parseFloat(sp.get("lon") ?? "");
  const name = sp.get("name")?.trim() ?? "";
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json(null);
  }

  try {
    const photo =
      (await fromWikipediaArticle(lat, lon, name)) ??
      (await fromCommonsNearby(lat, lon));
    return NextResponse.json(photo ?? null);
  } catch {
    return NextResponse.json(null, { status: 502 });
  }
}

const wiki = (host: string, params: Record<string, string>) =>
  fetch(
    `https://${host}/w/api.php?` +
      new URLSearchParams({ format: "json", origin: "*", ...params }),
    { headers: { "User-Agent": UA }, next: { revalidate: WEEK } },
  );

// --- Strategy A: nearest Wikipedia article's lead image -------------------
type WikiPage = {
  index: number;
  title: string;
  pageimage?: string;
  thumbnail?: { source: string; width: number; height: number };
};

async function fromWikipediaArticle(
  lat: number,
  lon: number,
  name: string,
): Promise<PlacePhotoData | null> {
  const res = await wiki("en.wikipedia.org", {
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
  if (pages.length === 0) return null;

  // Prefer a name match; otherwise the closest article (geosearch order).
  const lc = name.toLowerCase();
  const byName = lc
    ? pages.find((p) => p.title.toLowerCase().includes(lc))
    : undefined;
  const pick =
    byName ?? pages.sort((a, b) => a.index - b.index)[0];
  const thumb = pick.thumbnail!;

  const attr = pick.pageimage
    ? await fileAttribution(pick.pageimage)
    : null;
  return {
    url: thumb.source,
    width: thumb.width,
    height: thumb.height,
    title: pick.title,
    author: attr?.author,
    license: attr?.license,
    source:
      attr?.source ??
      `https://en.wikipedia.org/wiki/${encodeURIComponent(
        pick.title.replace(/ /g, "_"),
      )}`,
  };
}

// --- Strategy B: any geotagged Commons photo near the coords --------------
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
  const res = await wiki("commons.wikimedia.org", {
    action: "query",
    prop: "imageinfo",
    iiprop: "url|extmetadata|mime",
    iiurlwidth: "800",
    generator: "geosearch",
    ggsnamespace: "6",
    ggscoord: `${lat}|${lon}`,
    ggsradius: "250",
    ggslimit: "15",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    query?: { pages?: Record<string, CommonsFile> };
  };
  const files = Object.values(data.query?.pages ?? {})
    .filter((f) => {
      const ii = f.imageinfo?.[0];
      return (
        ii?.thumburl && /^image\/(jpe?g|png|webp)$/.test(ii.mime ?? "")
      );
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

// --- Attribution lookup for a Commons file by name ------------------------
async function fileAttribution(
  fileName: string,
): Promise<{ author?: string; license?: string; source?: string } | null> {
  const res = await wiki("commons.wikimedia.org", {
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
