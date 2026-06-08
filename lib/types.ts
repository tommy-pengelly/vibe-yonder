export type LatLon = { lat: number; lon: number };

export type Destination = LatLon & {
  name: string;
  label?: string;
};

export type Fix = LatLon & {
  acc: number | null;
  alt: number | null;
  t: number;
};

export type GeocodeResult = LatLon & {
  name: string;
  label: string;
};
