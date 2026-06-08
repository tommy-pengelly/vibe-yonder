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

export type SavedYonder = {
  id: string;
  name: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  walked: number;
  direct: number;
  yondered: number;
  track: Fix[];
  pausedMs: number;
  /** Snapshot of the primary destination (for Single/Ordered) or yonder centroid. */
  destination: Destination;
};

export type AuthUser = {
  id: string;
  email?: string;
  displayName?: string;
};
