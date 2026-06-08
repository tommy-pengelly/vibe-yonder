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

export type Journey = {
  name: string;
  waypoints: Destination[];
  activeIndex: number;
};

export type Poi = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  seen: boolean;
};
