import { haversine } from "./geo";
import type { GeocodeResult, LatLon, RankedResult } from "./types";

export function rankResults(
  results: GeocodeResult[],
  me: LatLon | null,
): RankedResult[] {
  if (!me) return results;
  return results
    .map((r): RankedResult => {
      const dist = haversine(me.lat, me.lon, r.lat, r.lon);
      const proximity = 1 / (1 + dist / 1000);
      const score = (r.importance ?? 0) * 0.55 + proximity * 0.45;
      return { ...r, dist, score };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}
