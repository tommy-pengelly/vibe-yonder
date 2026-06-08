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
  username?: string;
  displayName?: string;
  avatarUrl?: string;
};

// ----- Social (Doc 3) -----

export type Visibility = "private" | "followers" | "public";

export type Profile = {
  id: string;
  username: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  isPrivate: boolean;
};

/** A shared yonder as the Feed / profile cards consume it (obfuscated copy). */
export type FeedYonder = {
  id: string;
  userId: string;
  who: string; // display name, falls back to @username
  handle: string; // @username
  avatarUrl?: string;
  when: string; // relative time, e.g. "2h ago"
  caption: string | null;
  area: string; // vague "near X", never coordinates
  walked: number;
  mins: number;
  places: number;
  yondered: number;
  trace: number[][]; // obfuscated normalized 0–100 memento
  destinations: Destination[]; // the shared places (to "Yonder this")
  grubs: number;
  grubbed: boolean;
};

/** A public map (collection) as the Community cards consume it. */
export type FeedMap = {
  id: string;
  name: string;
  who: string; // @username of author
  places: number;
  grubs: number;
  grubbed: boolean;
  destinations: Destination[];
  previewDots: number[][]; // place scatter in 0–100 for the card preview
};

export type FollowCounts = { followers: number; following: number };

export type Settings = {
  hideNumbers: boolean;
  defaultVisibility: Visibility;
  privacyZone: { lat: number; lon: number; radiusM: number } | null;
};
