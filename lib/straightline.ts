import { alongFraction, crossTrack, haversine } from "./geo";
import type { LatLon, Medal, MedalBands } from "./types";

export type { MedalBands } from "./types";

/** A point of an attempt in the line's own frame: [alongFraction 0..1,
 * signed deviation metres]. No absolute coordinates. */
export type LinePoint = [number, number];

/** The attempt's shape relative to the line A→B, downsampled to ~maxPoints so
 * the stored path stays small. Drives the scoreboard overlay. */
export function linePath(
  track: LatLon[],
  a: LatLon,
  b: LatLon,
  maxPoints = 60,
): LinePoint[] {
  if (track.length === 0) return [];
  const step = Math.max(1, Math.ceil(track.length / maxPoints));
  const out: LinePoint[] = [];
  for (let i = 0; i < track.length; i += step) {
    const p = track[i];
    out.push([alongFraction(p, a, b), crossTrack(p, a, b)]);
  }
  const last = track[track.length - 1];
  out.push([alongFraction(last, a, b), crossTrack(last, a, b)]);
  return out;
}

// The straight-line mode: walk the line from A to B as straight as you can.
// Scored by deviation (never time). Medal = your *worst* moment off the line;
// the tiebreaker is average deviation, how tight you held the whole way.

// The creator sets the corridor half-widths (MedalBands, in types) per mission;
// these are the standard defaults.
export const DEFAULT_BANDS: MedalBands = {
  platinum: 12.5,
  gold: 25,
  silver: 50,
  bronze: 100,
};

/** Named difficulty presets the creation UI offers as quick-fills. */
export const BAND_PRESETS: { id: string; label: string; bands: MedalBands }[] = [
  { id: "casual", label: "Casual", bands: { platinum: 25, gold: 50, silver: 100, bronze: 200 } },
  { id: "standard", label: "Standard", bands: DEFAULT_BANDS },
  { id: "precision", label: "Precision", bands: { platinum: 5, gold: 10, silver: 20, bronze: 40 } },
];

/** Bands as an ordered (tightest → loosest) list, for scoring + drawing. */
export function bandList(
  bands: MedalBands = DEFAULT_BANDS,
): { medal: Exclude<Medal, "none">; half: number }[] {
  return [
    { medal: "platinum", half: bands.platinum },
    { medal: "gold", half: bands.gold },
    { medal: "silver", half: bands.silver },
    { medal: "bronze", half: bands.bronze },
  ];
}

export const MEDAL_LABEL: Record<Medal, string> = {
  platinum: "Platinum",
  gold: "Gold",
  silver: "Silver",
  bronze: "Bronze",
  none: "Finisher",
  dnf: "DNF",
};

// You must actually reach the end for any medal: completing ≥90% of the line's
// length, OR getting within FINISH_FLOOR_M of B. Otherwise it's a DNF, so you
// can't win platinum by holding a tight line for ten metres and stopping.
const FINISH_FRACTION = 0.9;
const FINISH_FLOOR_M = 30;

export function medalFor(maxDeviation: number, bands: MedalBands = DEFAULT_BANDS): Medal {
  for (const b of bandList(bands)) if (maxDeviation <= b.half) return b.medal;
  return "none";
}

export type StraightLineScore = {
  /** Worst distance off the line (m), sets the medal. */
  maxDeviation: number;
  /** Average |deviation| (m), the on-brand tiebreaker. */
  avgDeviation: number;
  /** Share of fixes within the bronze corridor (0–100). */
  inCorridorPct: number;
  medal: Medal;
};

/** Score a recorded track against the straight line A→B, with the mission's
 * bands (defaults to the standard tiers). */
export function scoreStraightLine(
  track: LatLon[],
  a: LatLon,
  b: LatLon,
  bands: MedalBands = DEFAULT_BANDS,
): StraightLineScore {
  if (track.length === 0) {
    // No movement after arming the line: a DNF, never a free platinum.
    return { maxDeviation: 0, avgDeviation: 0, inCorridorPct: 0, medal: "dnf" };
  }
  let max = 0;
  let sum = 0;
  let inside = 0;
  let maxAlong = 0; // furthest along the line you got (0..1)
  let minDistB = Infinity; // closest you came to the end B
  for (const p of track) {
    const d = Math.abs(crossTrack(p, a, b));
    if (d > max) max = d;
    sum += d;
    if (d <= bands.bronze) inside++;
    const f = alongFraction(p, a, b);
    if (f > maxAlong) maxAlong = f;
    const db = haversine(p.lat, p.lon, b.lat, b.lon);
    if (db < minDistB) minDistB = db;
  }
  const finished = maxAlong >= FINISH_FRACTION || minDistB <= FINISH_FLOOR_M;
  return {
    maxDeviation: max,
    avgDeviation: sum / track.length,
    inCorridorPct: (inside / track.length) * 100,
    medal: finished ? medalFor(max, bands) : "dnf",
  };
}
