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

/**
 * Signed cross-track distance (metres) from point P to the great-circle line
 * through A→B, how far off the straight line you are. Sign = which side
 * (positive ≈ to the right of A→B). The straight-line mode scores on |this|.
 */
export function crossTrack(p: LatLon, a: LatLon, b: LatLon): number {
  const R = 6371000;
  const d13 = haversine(a.lat, a.lon, p.lat, p.lon) / R; // angular A→P
  const th13 = toRad(bearing(a.lat, a.lon, p.lat, p.lon));
  const th12 = toRad(bearing(a.lat, a.lon, b.lat, b.lon));
  return Math.asin(Math.sin(d13) * Math.sin(th13 - th12)) * R;
}

/**
 * How far along A→B point P projects, as a fraction 0..1 of the line length
 * (clamped). Pairs with crossTrack to place a point in the line's own frame.
 */
export function alongFraction(p: LatLon, a: LatLon, b: LatLon): number {
  const R = 6371000;
  const total = haversine(a.lat, a.lon, b.lat, b.lon);
  if (total === 0) return 0;
  const d13 = haversine(a.lat, a.lon, p.lat, p.lon) / R; // angular A→P
  const xt = crossTrack(p, a, b) / R; // angular cross-track
  const along = Math.acos(Math.cos(d13) / Math.cos(xt)) * R;
  return Math.max(0, Math.min(1, along / total));
}

/**
 * Normalise several tracks into a *shared* 0–100 box (one combined bounding
 * box), so overlaid traces line up, "all the ways you moved around here".
 */
export function toUnitBoxMulti(
  tracks: { lat: number; lon: number }[][],
  pad = 12,
): number[][][] {
  const all = tracks.flat();
  if (all.length === 0) return tracks.map(() => []);
  const lats = all.map((p) => p.lat);
  const lons = all.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const span = Math.max((maxLon - minLon) * kx, maxLat - minLat, 1e-7);
  const range = 100 - 2 * pad;
  // Centre the shorter axis: one shared span keeps aspect, so the narrower axis
  // underfills the box. Offset it by half the slack instead of pinning an edge.
  const offX = (range - (((maxLon - minLon) * kx) / span) * range) / 2;
  const offY = (range - ((maxLat - minLat) / span) * range) / 2;
  return tracks.map((tr) =>
    tr.map((p) => [
      pad + offX + (((p.lon - minLon) * kx) / span) * range,
      100 - pad - offY - ((p.lat - minLat) / span) * range,
    ]),
  );
}

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
 * cards, trace shapes and POI scatters. Longitude is scaled by cos(lat) so the
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
  // Centre the shorter axis (see toUnitBoxMulti) so the shape sits in the
  // middle of the card rather than pinned to a corner.
  const offX = (range - (((maxLon - minLon) * kx) / span) * range) / 2;
  const offY = (range - ((maxLat - minLat) / span) * range) / 2;
  return pts.map((p) => {
    if (pts.length === 1) return [50, 50];
    const x = pad + offX + (((p.lon - minLon) * kx) / span) * range;
    const y = 100 - pad - offY - ((p.lat - minLat) / span) * range; // north up
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

export type BearingEstimate = {
  /** Smoothed direction of travel, degrees from true north, or null when unknown. */
  bearing: number | null;
  /** How committed the heading is, 0 (churning / stopped) → 1 (dead-straight). */
  confidence: number;
};

/**
 * Travel-bearing + confidence estimator for the discovery engine. Distinct from
 * `makeAngleSmoother` (that only unwraps an angle for CSS): this measures the
 * *trend* of where you're actually walking.
 *
 * Bearings wrap at 360°, so we can't average them as scalars, we keep a
 * decaying, displacement-weighted mean of heading **unit-vectors**. One vector
 * yields both signals: its angle is the smoothed bearing, its length (0–1) is
 * the confidence (the circular resultant length). Standstill jitter (steps
 * below `minStepM`) is ignored, so confidence falls back gracefully and callers
 * can degrade to a pure distance gate when it's low.
 */
export function makeTravelBearing(opts?: { halfLifeM?: number; minStepM?: number }) {
  const halfLifeM = opts?.halfLifeM ?? 150;
  const minStepM = opts?.minStepM ?? 5;
  let prev: { lat: number; lon: number } | null = null;
  let ax = 0; // Σ unit.x · weight (decayed)
  let ay = 0; // Σ unit.y · weight (decayed)
  let w = 0; // Σ weight (decayed)
  let last: BearingEstimate = { bearing: null, confidence: 0 };

  const value = () => last;

  const push = (fix: { lat: number; lon: number }): BearingEstimate => {
    if (!prev) {
      prev = { lat: fix.lat, lon: fix.lon };
      return last;
    }
    const d = haversine(prev.lat, prev.lon, fix.lat, fix.lon);
    if (d < minStepM) return last; // jitter / standstill, keep prev anchor
    const b = bearing(prev.lat, prev.lon, fix.lat, fix.lon);
    const rad = toRad(b);
    // Distance-window decay: older motion fades over ~halfLifeM of travel.
    const k = Math.exp(-d / halfLifeM);
    ax = ax * k + Math.cos(rad) * d;
    ay = ay * k + Math.sin(rad) * d;
    w = w * k + d;
    prev = { lat: fix.lat, lon: fix.lon };
    const mx = ax / w;
    const my = ay / w;
    last = {
      bearing: (toDeg(Math.atan2(my, mx)) + 360) % 360,
      confidence: Math.min(1, Math.hypot(mx, my)),
    };
    return last;
  };

  const reset = () => {
    prev = null;
    ax = ay = w = 0;
    last = { bearing: null, confidence: 0 };
  };

  return { push, value, reset };
}
