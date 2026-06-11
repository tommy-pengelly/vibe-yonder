// Shared catalogue for nearby/category discovery. No client-only deps so both
// the /api/nearby route and the UI can import it.

export type NearbyPlace = {
  name: string;
  lat: number;
  lon: number;
  category: string;
  dist?: number;
  /** Wikipedia title or wikidata id when the place has one, a free, on-brand
   * "notable" signal (no external ratings). */
  wiki?: string;
  /** Stable OSM ref ("node/123"), for de-dupe and the seen/skipped ledger. */
  id?: string;
  /** Which ambient ring the place surfaced from (Doc 7 Part B). Drives the
   * "far must be notable" gate; absent on the plain single-category path. */
  klass?: "any" | "interesting" | "notable";
  /** Part of a brand/chain (has a `brand` / `brand:wikidata` tag). We send
   * people to locally-run places, so chains are deprioritised, but never on a
   * *notable* place (`wiki` trumps this: the Emirates is a chain by tag, a
   * landmark by visit). See `score()`. */
  chain?: boolean;
};

// Ambient discovery rings (Doc 7 Part B): near = anything in the active
// categories, further out = only progressively more notable. The bar rises with
// distance, which is what keeps the void uncluttered. Invariant: the *widest*
// radius pairs with the *sparsest* filter (wiki-only), so the union stays light.
export const NEARBY_RINGS = {
  any: 400, // ring 0, the active category, if any
  interesting: 1200, // ring 1, worth-a-detour tags regardless of category
  notable: 3000, // ring 2, only places with a Wikipedia / wikidata entry
} as const;

// Ring-1 selectors: "interesting regardless of what you asked for". Deliberately
// the non-food discoveries, food/errands belong to an explicit category search.
export const INTERESTING_FILTERS = [
  '"tourism"="viewpoint"',
  '"tourism"="artwork"',
  '"tourism"="gallery"',
  '"tourism"="museum"',
  '"historic"',
  '"leisure"="park"',
  '"leisure"="garden"',
  '"natural"="water"',
];

export type Category = {
  key: string;
  label: string;
  emoji: string;
  /** Overpass tag selectors; any match counts. */
  filters: string[];
};

// Curated, exploration-flavoured, things worth wandering *toward*, not a full
// amenity directory. Order is the chip order in the UI.
export const CATEGORIES: Category[] = [
  { key: "cafe", label: "Café", emoji: "☕", filters: ['"amenity"="cafe"'] },
  {
    key: "pub",
    label: "Pub",
    emoji: "🍺",
    filters: ['"amenity"="pub"', '"amenity"="bar"'],
  },
  {
    key: "food",
    label: "Food",
    emoji: "🍜",
    filters: ['"amenity"="restaurant"', '"amenity"="fast_food"'],
  },
  { key: "park", label: "Park", emoji: "🌳", filters: ['"leisure"="park"'] },
  {
    key: "viewpoint",
    label: "Viewpoint",
    emoji: "🗻",
    filters: ['"tourism"="viewpoint"'],
  },
  {
    key: "garden",
    label: "Garden",
    emoji: "🌷",
    filters: ['"leisure"="garden"'],
  },
  {
    key: "art",
    label: "Art",
    emoji: "🎨",
    filters: ['"tourism"="artwork"', '"tourism"="gallery"'],
  },
  {
    key: "history",
    label: "History",
    emoji: "🏛️",
    filters: ['"historic"', '"tourism"="museum"'],
  },
  {
    key: "water",
    label: "Water",
    emoji: "💧",
    filters: ['"natural"="water"', '"waterway"="riverbank"'],
  },
];

export function categoryByKey(key: string): Category | undefined {
  return CATEGORIES.find((c) => c.key === key);
}
