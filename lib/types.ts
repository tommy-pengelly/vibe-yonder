export type LatLon = { lat: number; lon: number };

export type Destination = LatLon & {
  name: string;
  label?: string;
};

export type Fix = LatLon & {
  acc: number | null;
  t: number;
};

export type GeocodeResult = LatLon & {
  name: string;
  label: string;
  importance: number;
};

export type RankedResult = GeocodeResult & {
  dist?: number;
  score?: number;
};

export type YonderMode = "single" | "collection" | "ordered";

export type Target = {
  id: string;
  name: string;
  label?: string;
  lat: number;
  lon: number;
  visited: boolean;
  visitedAt?: number;
};

export type ActiveYonder = {
  id: string;
  mode: YonderMode;
  targets: Target[];
  /** Index of the bold/full-amber target. `null` for Collection (no current focus). */
  activeIndex: number | null;
  name?: string;
};

export type FavouritePlace = {
  id: string;
  name: string;
  label?: string;
  lat: number;
  lon: number;
  createdAt: number;
};

export type StoredMapItem = {
  id: string;
  name: string;
  label?: string;
  lat: number;
  lon: number;
  visited: boolean;
  visitedAt?: number;
};

/** A map: a saved, reusable set of places to yonder. */
export type StoredMap = {
  id: string;
  name: string;
  mode: YonderMode;
  items: StoredMapItem[];
  createdAt: number;
  updatedAt: number;
};

/** A bookmarked place or map, persisted via Save for later. */
export type StoredSaved = {
  id: string;
  kind: "place" | "map";
  refId: string;
  /** Snapshot fields for quick display without dereferencing. */
  name: string;
  /** Only set for kind=place. */
  lat?: number;
  lon?: number;
  createdAt: number;
};

export type SavedYonder = {
  id: string;
  name: string;
  mode: YonderMode;
  /** All targets, in their original order (Ordered) or as-added (Collection / Single). */
  destinations: Destination[];
  startedAt: number;
  endedAt: number;
  durationMs: number;
  walked: number;
  direct: number;
  yondered: number;
  track: Fix[];
  pausedMs: number;
  /** Optional source-map link, set when the yonder began from a saved map. */
  mapId?: string;
};

export type AuthUser = {
  id: string;
  email?: string;
  displayName?: string;
};
