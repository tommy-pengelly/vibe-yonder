import { haversine } from "./geo";
import type { FavouritePlace, GeocodeResult, LatLon, RankedResult } from "./types";

// This is a walking app: "near" means a few hundred metres, not a few km. So
// proximity is weighted above raw place importance and decays fast. PROX_HALF is
// the distance at which the proximity term halves (≈500 m), which pulls the
// place around the corner above the famous one across town. Importance still
// breaks ties and rescues a far-but-exact-name match (the empty state nudges
// "try adding the town" when the right hit is genuinely distant).
const PROX_HALF_M = 500;
const W_IMPORTANCE = 0.4;
const W_PROXIMITY = 0.6;

export function rankResults(
  results: GeocodeResult[],
  me: LatLon | null,
): RankedResult[] {
  if (!me) return results;
  return results
    .map((r): RankedResult => {
      const dist = haversine(me.lat, me.lon, r.lat, r.lon);
      const proximity = 1 / (1 + dist / PROX_HALF_M);
      const score = (r.importance ?? 0) * W_IMPORTANCE + proximity * W_PROXIMITY;
      return { ...r, dist, score };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

// Resolve a query against the user's saved places so typing "home" finds Home.
// Matches the alias first (that's the name they gave it), then the place name /
// label. Returned as RankedResults flagged `favourite` so the UI can mark them,
// and meant to sit ABOVE geocode hits, since a saved place is the strongest
// possible intent. Runs at any query length (geocode waits for 3 chars).
export function matchFavourites(
  query: string,
  favourites: FavouritePlace[],
  me: LatLon | null,
  cap = 4,
): RankedResult[] {
  const term = query.trim().toLowerCase();
  if (!term) return [];

  const scored = favourites
    .map((f) => {
      const alias = (f.alias ?? "").toLowerCase();
      const name = f.name.toLowerCase();
      const label = (f.label ?? "").toLowerCase();
      // Rank: alias exact > alias prefix > alias/name contains. -1 = no match.
      let rank = -1;
      if (alias === term) rank = 4;
      else if (alias.startsWith(term)) rank = 3;
      else if (name.startsWith(term)) rank = 2;
      else if (alias.includes(term) || name.includes(term) || label.includes(term))
        rank = 1;
      return { f, rank };
    })
    .filter((x) => x.rank >= 0)
    .sort((a, b) => b.rank - a.rank);

  return scored.slice(0, cap).map(({ f }): RankedResult => {
    const dist = me ? haversine(me.lat, me.lon, f.lat, f.lon) : undefined;
    return {
      // The alias is what they typed toward, so lead with it; keep the real
      // place name as the label so they can tell which spot it is.
      name: f.alias || f.name,
      label: f.alias ? f.name : (f.label ?? ""),
      lat: f.lat,
      lon: f.lon,
      importance: 1,
      dist,
      // Above any geocode score (which maxes at W_IMPORTANCE + W_PROXIMITY = 1).
      score: 100,
      favourite: true,
    };
  });
}

// Drop geocode hits that coincide with a favourite already shown (same spot to
// ~40 m), so "home" doesn't list your Home twice.
export function mergeFavouritesFirst(
  favMatches: RankedResult[],
  geo: RankedResult[],
): RankedResult[] {
  if (favMatches.length === 0) return geo;
  const near = (a: RankedResult, b: RankedResult) =>
    haversine(a.lat, a.lon, b.lat, b.lon) < 40;
  const rest = geo.filter((g) => !favMatches.some((f) => near(f, g)));
  return [...favMatches, ...rest];
}
