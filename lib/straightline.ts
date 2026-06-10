import { crossTrack } from "./geo";
import type { LatLon, Medal } from "./types";

// The straight-line mode: walk the line from A to B as straight as you can.
// Scored by deviation (never time). Medal = your *worst* moment off the line;
// the tiebreaker is average deviation — how tight you held the whole way.

/** Corridor half-widths (m), tightest → loosest. "Either way" = ± this. */
export const MEDAL_BANDS: { medal: Exclude<Medal, "none">; half: number }[] = [
  { medal: "platinum", half: 12.5 },
  { medal: "gold", half: 25 },
  { medal: "silver", half: 50 },
  { medal: "bronze", half: 100 },
];

export const MEDAL_LABEL: Record<Medal, string> = {
  platinum: "Platinum",
  gold: "Gold",
  silver: "Silver",
  bronze: "Bronze",
  none: "Finisher",
};

export function medalFor(maxDeviation: number): Medal {
  for (const b of MEDAL_BANDS) if (maxDeviation <= b.half) return b.medal;
  return "none";
}

export type StraightLineScore = {
  /** Worst distance off the line (m) — sets the medal. */
  maxDeviation: number;
  /** Average |deviation| (m) — the on-brand tiebreaker. */
  avgDeviation: number;
  /** Share of fixes within the bronze corridor (0–100). */
  inCorridorPct: number;
  medal: Medal;
};

/** Score a recorded track against the straight line A→B. */
export function scoreStraightLine(
  track: LatLon[],
  a: LatLon,
  b: LatLon,
  corridorHalf = 100,
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
    if (d <= corridorHalf) inside++;
  }
  return {
    maxDeviation: max,
    avgDeviation: sum / track.length,
    inCorridorPct: (inside / track.length) * 100,
    medal: medalFor(max),
  };
}
