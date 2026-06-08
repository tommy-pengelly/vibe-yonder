import { NextResponse, type NextRequest } from "next/server";

type NominatimResult = {
  name?: string;
  display_name: string;
  lat: string;
  lon: string;
};

const CONTACT =
  process.env.NOMINATIM_CONTACT ??
  "tom.peng95@gmail.com";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 3) return NextResponse.json([]);

  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?format=jsonv2&limit=6&q=${encodeURIComponent(q)}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": `VibeYonder/0.1 (${CONTACT})`,
      Accept: "application/json",
    },
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!res.ok) return NextResponse.json([], { status: 502 });

  const raw = (await res.json()) as NominatimResult[];
  const results = raw.map((r) => ({
    name: r.name || String(r.display_name).split(",")[0],
    label: r.display_name,
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
  }));
  return NextResponse.json(results);
}
