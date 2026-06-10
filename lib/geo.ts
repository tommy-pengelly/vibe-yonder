import type { LatLon } from "./types";

export const toRad = (d: number) => (d * Math.PI) / 180;
export const toDeg = (r: number) => (r * 180) / Math.PI;

/** Initial great-circle bearing A→B, degrees clockwise from true north. */
export function bearing(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
) {
  const phi1 = toRad(aLat);
  const phi2 = toRad(bLat);
  const dLam = toRad(bLon - aLon);
  const y = Math.sin(dLam) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLam);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Distance in metres (haversine). */
export function haversine(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
) {
  const R = 6371000;
  const phi1 = toRad(aLat);
  const phi2 = toRad(bLat);
  const dPhi = toRad(bLat - aLat);
  const dLam = toRad(bLon - aLon);
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLam / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const fmtDist = (m: number) =>
  m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;

/** Rough real-world extent of a set of points: the bounding-box diagonal. */
export function spanMeters(pts: { lat: number; lon: number }[]): number {
  if (pts.length < 2) return 0;
  const lats = pts.map((p) => p.lat);
  const lons = pts.map((p) => p.lon);
  return haversine(
    Math.min(...lats),
    Math.min(...lons),
    Math.max(...lats),
    Math.max(...lons),
  );
}

/**
 * Normalise lat/lon points into a padded 0–100 box (north-up) for tiny SVG
 * cards — trace shapes and POI scatters. Longitude is scaled by cos(lat) so the
 * shape isn't stretched. A single point (or degenerate span) sits centred.
 */
export function toUnitBox(
  pts: { lat: number; lon: number }[],
  pad = 12,
): number[][] {
  if (pts.length === 0) return [];
  const lats = pts.map((p) => p.lat);
  const lons = pts.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const span = Math.max((maxLon - minLon) * kx, maxLat - minLat, 1e-7);
  const range = 100 - 2 * pad;
  return pts.map((p) => {
    if (pts.length === 1) return [50, 50];
    const x = pad + (((p.lon - minLon) * kx) / span) * range;
    const y = 100 - pad - ((p.lat - minLat) / span) * range; // north up
    return [x, y];
  });
}

export const fmtDuration = (ms: number) => {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

/** World → screen, user fixed at centre, north-up. */
export function toScreen(
  p: LatLon,
  me: LatLon,
  w: number,
  h: number,
  mpp: number,
) {
  const kx = Math.cos(toRad(me.lat));
  const east = (p.lon - me.lon) * kx * 111320;
  const north = (p.lat - me.lat) * 110540;
  return { x: w / 2 + east / mpp, y: h / 2 - north / mpp };
}

/** Place an arrow on a ring of radius R at a compass bearing (north-up). */
export function edgeArrow(
  bearingDeg: number,
  R: number,
  w: number,
  h: number,
) {
  const a = toRad(bearingDeg);
  return {
    x: w / 2 + R * Math.sin(a),
    y: h / 2 - R * Math.cos(a),
    rot: bearingDeg,
  };
}

/**
 * Shortest-path angle smoother. Returns a stateful function that converts a
 * target heading (0–360, can jump 359→0) into a continuously increasing or
 * decreasing value, so CSS rotation animates the short way round.
 */
export function makeAngleSmoother() {
  let acc: number | null = null;
  return (target: number) => {
    if (acc === null) {
      acc = target;
      return acc;
    }
    acc += (((target - (acc % 360)) + 540) % 360) - 180;
    return acc;
  };
}
