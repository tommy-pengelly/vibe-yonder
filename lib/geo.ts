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

export const fmtDuration = (ms: number) => {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
};

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
