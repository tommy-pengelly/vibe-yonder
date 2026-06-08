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

export type ListItemState = {
  id: string;
  name: string;
  label?: string;
  lat: number;
  lon: number;
  visited: boolean;
  visitedAt?: number;
};

export type StoredList = {
  id: string;
  name: string;
  items: ListItemState[];
  createdAt: number;
  updatedAt: number;
};

export type ListJourney = {
  list: StoredList;
  activeIndex: number;
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
  destination: Destination;
};

export type Poi = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  seen: boolean;
};

export type AuthUser = {
  id: string;
  email?: string;
  displayName?: string;
};
