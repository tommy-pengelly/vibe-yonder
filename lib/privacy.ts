// Trace obfuscation. Sharing a yonder must NEVER expose where you physically
// went — the precise track stays owner-only. What we publish is a decorative
// memento: a normalized squiggle with the home zone removed and the ends
// trimmed, so it reads as "a wander" without being a path anyone can follow.
import { haversine } from "./geo";
import type { Destination, Fix } from "./types";

/** Metres trimmed off each end of the trace (hides start/finish near home). */
const TRIM_M = 180;
/** Max points in the published memento (downsample for size + vagueness). */
const MAX_POINTS = 48;

export type PrivacyZone = { lat: number; lon: number; radiusM: number } | null;

/**
 * Turn a precise track into a publishable, normalized 0–100 memento. Drops
 * points inside the home privacy zone, trims ~TRIM_M off each end, downsamples,
 * and strips all real coordinates — the result is just shape, in a unit box.
 */
export function obfuscateTrace(track: Fix[], zone?: PrivacyZone): number[][] {
  if (track.length < 2) return [];
  let pts: Fix[] = track;

  if (zone) {
    pts = pts.filter((p) => haversine(p.lat, p.lon, zone.lat, zone.lon) > zone.radiusM);
    if (pts.length < 2) return [];
  }

  pts = trimEnds(pts, TRIM_M);
  if (pts.length < 2) return [];

  pts = downsample(pts, MAX_POINTS);
  return normalize(pts);
}

function trimEnds(pts: Fix[], metres: number): Fix[] {
  if (pts.length < 3) return pts;
  let start = 0;
  let acc = 0;
  for (let i = 1; i < pts.length && acc < metres; i++) {
    acc += haversine(pts[i - 1].lat, pts[i - 1].lon, pts[i].lat, pts[i].lon);
    start = i;
  }
  let end = pts.length - 1;
  acc = 0;
  for (let i = pts.length - 1; i > 0 && acc < metres; i--) {
    acc += haversine(pts[i].lat, pts[i].lon, pts[i - 1].lat, pts[i - 1].lon);
    end = i - 1;
  }
  if (end - start < 1) return pts; // too short to trim — keep the shape
  return pts.slice(start, end + 1);
}

function downsample(pts: Fix[], max: number): Fix[] {
  if (pts.length <= max) return pts;
  const step = pts.length / max;
  const out: Fix[] = [];
  for (let i = 0; i < max; i++) out.push(pts[Math.floor(i * step)]);
  out.push(pts[pts.length - 1]);
  return out;
}

/** Map lat/lon into a padded 0–100 box (SVG y-down), stripping real coords. */
function normalize(pts: Fix[]): number[][] {
  const lats = pts.map((p) => p.lat);
  const lons = pts.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const span = Math.max((maxLon - minLon) * kx, maxLat - minLat, 1e-7);
  const PAD = 10;
  const SCALE = 100 - 2 * PAD;
  return pts.map((p) => [
    +(PAD + (((p.lon - minLon) * kx) / span) * SCALE).toFixed(1),
    +(100 - PAD - ((p.lat - minLat) / span) * SCALE).toFixed(1),
  ]);
}

/** A vague area label for a shared yonder — derived from a place name, never
 * coordinates. "Hampstead Heath, London" -> "near Hampstead Heath". */
export function areaLabel(destinations: Pick<Destination, "name">[]): string {
  const first = destinations[0]?.name?.split(",")[0]?.trim();
  return first ? `near ${first}` : "somewhere";
}
