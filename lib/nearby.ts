// Shared catalogue for nearby/category discovery. No client-only deps so both
// the /api/nearby route and the UI can import it.

export type NearbyPlace = {
  name: string;
  lat: number;
  lon: number;
  category: string;
  dist?: number;
  /** Wikipedia title or wikidata id when the place has one — a free, on-brand
   * "notable" signal (no external ratings). */
  wiki?: string;
};

export type Category = {
  key: string;
  label: string;
  emoji: string;
  /** Overpass tag selectors; any match counts. */
  filters: string[];
};

// Curated, exploration-flavoured — things worth wandering *toward*, not a full
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
