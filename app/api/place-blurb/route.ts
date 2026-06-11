import { NextResponse, type NextRequest } from "next/server";

// A short Wikipedia blurb for a place (the text companion to /api/place-photo).
// Keyless, on-brand (CLAUDE.md anticipates "Wikipedia blurbs"). Coverage is
// uneven by design: famous places resolve, an ordinary corner returns null.
// Feeds curiosity at a place, never navigation.

const CONTACT = process.env.NOMINATIM_CONTACT ?? "tom.peng95@gmail.com";
const WEEK = 60 * 60 * 24 * 7;

type WikiPage = {
  index: number;
  title: string;
  extract?: string;
};

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lat = parseFloat(sp.get("lat") ?? "");
  const lon = parseFloat(sp.get("lon") ?? "");
  const name = sp.get("name")?.trim() ?? "";
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json(null);
  }

  try {
    const res = await fetch(
      `https://en.wikipedia.org/w/api.php?` +
        new URLSearchParams({
          format: "json",
          origin: "*",
          action: "query",
          prop: "extracts",
          exintro: "1",
          explaintext: "1",
          exsentences: "3",
          generator: "geosearch",
          ggscoord: `${lat}|${lon}`,
          ggsradius: "1000",
          ggslimit: "8",
        }),
      { headers: { "User-Agent": `VibeYonder/1.0 (${CONTACT})` }, next: { revalidate: WEEK } },
    );
    if (!res.ok) return NextResponse.json(null);
    const data = (await res.json()) as {
      query?: { pages?: Record<string, WikiPage> };
    };
    const pages = Object.values(data.query?.pages ?? {}).filter(
      (p) => p.extract && p.extract.trim().length > 0,
    );
    if (pages.length === 0) return NextResponse.json(null);

    // Prefer a name match; otherwise the nearest article (geosearch order).
    const lc = name.toLowerCase();
    const pick =
      (lc && pages.find((p) => p.title.toLowerCase().includes(lc))) ||
      pages.sort((a, b) => a.index - b.index)[0];

    return NextResponse.json({
      title: pick.title,
      extract: pick.extract!.trim(),
      source: `https://en.wikipedia.org/wiki/${encodeURIComponent(
        pick.title.replace(/ /g, "_"),
      )}`,
    });
  } catch {
    return NextResponse.json(null, { status: 502 });
  }
}
