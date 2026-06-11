export type LatLon = { lat: number; lon: number };

/** A place photo resolved from Wikimedia. Attribution is mandatory (CC). */
export type PlacePhotoData = {
  url: string;
  width?: number;
  height?: number;
  /** What the photo is of — page or file title. */
  title: string;
  /** Plain-text author, when known. */
  author?: string;
  /** e.g. "CC BY-SA 4.0". */
  license?: string;
  /** Link back to the source description page (attribution requirement). */
  source: string;
};

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

export type PlayMode = "ambient" | "straightline";

export type Medal = "platinum" | "gold" | "silver" | "bronze" | "none";

export type ActiveYonder = {
  id: string;
  mode: YonderMode;
  targets: Target[];
  /** Index of the bold/full-amber target. `null` for Collection (no current focus). */
  activeIndex: number | null;
  name?: string;
  /**
   * "ambient" = the just-yonder discovery mode (engine surfaces nearby places).
   * "straightline" = hold the line from `origin` to the single target.
   */
  play?: PlayMode;
  /** Straight-line start point (A). The line runs origin→targets[0]. */
  origin?: LatLon;
  /** Straight line: false while walking to A; true once the line has begun. */
  lineArmed?: boolean;
  /** When the line was armed (scoring starts here). */
  lineArmedAt?: number;
  /** Optional shared mission this straight-line attempt is against. */
  missionId?: string;
};

export type FavouritePlace = {
  id: string;
  name: string;
  label?: string;
  lat: number;
  lon: number;
  createdAt: number;
  /** A personal nickname — "Home", "Work", "Best café" — shown instead of name. */
  alias?: string;
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
  /** Community sharing. Cloud-only; guests' maps are always private. */
  visibility?: "private" | "public";
};

/**
 * @deprecated Save-for-later folded into Maps (one place → Favourite, several →
 * a Map) via `saveYonderPlaces`. The `saved` table + this type are retained but
 * no longer written from the UI.
 */
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
  /** A note the owner writes in the recap; pre-fills the share caption. */
  caption?: string;
  /** Play mode, when not a plain wander. */
  play?: PlayMode;
  /** Straight-line: the line walked (A) and its result. */
  origin?: LatLon;
  straightLine?: {
    maxDeviation: number;
    avgDeviation: number;
    inCorridorPct: number;
    medal: Medal;
  };
  missionId?: string;
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
  /** Straight-line yonders carry their medal + mission, shown on the card. */
  medal?: Medal;
  missionId?: string;
};

/** A "ways report" post — someone's exploration overview — in the feed. */
export type FeedWays = {
  id: string;
  who: string;
  handle: string;
  avatarUrl?: string;
  when: string;
  caption: string | null;
  count: number; // ways (yonders) in the report
  km: number;
  placesSeen: number;
  traces: number[][][]; // overlaid normalised 0–100 traces
};

/** A "mission set" post — someone created a straight-line challenge. */
export type FeedMission = {
  id: string; // post id
  missionId: string; // the mission to open
  who: string;
  handle: string;
  avatarUrl?: string;
  when: string;
  name: string;
  distanceM: number;
};

/** One item in the unified feed — a community post of any kind. */
export type FeedItem =
  | { kind: "yonder"; id: string; when: string; y: FeedYonder }
  | { kind: "map"; id: string; when: string; m: FeedMap }
  | { kind: "ways"; id: string; when: string; w: FeedWays }
  | { kind: "mission"; id: string; when: string; mi: FeedMission };

/** A public map (collection) as the Community cards consume it. */
export type FeedMap = {
  id: string;
  /** The underlying map id, for Duplicate / Load (distinct from the post id). */
  mapId?: string;
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

export type NotificationItem = {
  id: string;
  type: "follow" | "follow_request" | "grub";
  actor: { username: string; displayName?: string } | null;
  subjectType?: "yonder" | "map";
  subjectId?: string;
  when: string;
  read: boolean;
};

export type ReportItem = {
  id: string;
  reporter: { username: string; displayName?: string } | null;
  targetType: string;
  targetId: string;
  reason: string | null;
  resolved: boolean;
  when: string;
};
