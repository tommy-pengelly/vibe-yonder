import { alongFraction, crossTrack } from "./geo";
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
};

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
    return { maxDeviation: 0, avgDeviation: 0, inCorridorPct: 100, medal: "platinum" };
  }
  let max = 0;
  let sum = 0;
  let inside = 0;
  for (const p of track) {
    const d = Math.abs(crossTrack(p, a, b));
    if (d > max) max = d;
    sum += d;
    if (d <= bands.bronze) inside++;
  }
  return {
    maxDeviation: max,
    avgDeviation: sum / track.length,
    inCorridorPct: (inside / track.length) * 100,
    medal: medalFor(max, bands),
  };
}
