// The ambient-discovery scoring brain (Doc 7). One pure function decides what's
// worth wandering toward — a *draw* (how much it pulls you) weighed against a
// *cost* (what reaching it asks). Surface when draw ≥ cost. Every refinement
// (distance gate, "must be good to turn around for", guides, familiarity) is a
// term on one side of that single inequality, which is why the ambient mode,
// sidequests, and category search can all share this one function.
//
// On-brand invariant: we rank by *notability* (there's a story here), NEVER by
// quality/ratings/popularity (banned — and not licence-cleanly free anyway).

import { bearing, haversine, toRad } from "./geo";
import type { LatLon } from "./types";
import type { NearbyPlace } from "./nearby";

/** A POI in scoring form. Extends the route's NearbyPlace with an id + signals. */
export type Candidate = NearbyPlace & {
  /** Stable OSM "node/123" id, or a coord-hash fallback for non-OSM places. */
  id: string;
  /** Photon importance passthrough (0–1) when available; OSM POIs won't have it. */
  importance?: number;
  /** Which ring the route placed it in (drives the far-must-be-notable gate). */
  klass?: "any" | "interesting" | "notable";
};

export type ScoreCtx = {
  origin: LatLon;
  /** Direction of travel (deg from N) or null — null ⇒ no directional term. */
  travelBearing: number | null;
  /** 0–1; scales the turn-around penalty so churn opens the engine to all sides. */
  confidence: number;
  /** An active guide/category key, or null. Leans draw toward it — never blinds. */
  activeGuide: string | null;
  /** 0–1 penalty from the seen/skipped ledger; subtracted from draw. */
  familiarity?: (id: string) => number;
};

export type Scored = Candidate & {
  dist: number;
  draw: number;
  cost: number;
  /** draw − cost. Surfaced when ≥ 0. */
  value: number;
  surfaced: boolean;
};

// Tunable — expect to tweak these on a real walk. All in "draw units": a node
// at REFERENCE_M costs ~1, so notability (max ~0.9) must be helped by proximity
// or a guide to clear distant ground. Keep them here, commented.
export const TUNING = {
  // Distance that costs ~1 draw unit. Calibrated to the ring radii (Doc 7 / Part
  // B): a max-notability node (~0.9) surfaces out to ~3 km (ring 2), an
  // "interesting" one (~0.55) to ~1.9 km (ring 1), a plain amenity (~0.2) only
  // to ~700 m (ring 0). Set below the far ring and notable places get gated by
  // distance before the route's wiki-only filter even applies.
  REFERENCE_M: 3500,
  DIR_WEIGHT: 1.2, // max turn-around penalty (at confidence 1, directly behind)
  GUIDE_BOOST: 0.5, // draw added to a guide-matching category (modest — leans)
  // Notability tier cutoffs (on the 0–1 notability scale).
  TIER_NOTABLE: 0.75,
  TIER_NOTED: 0.5,
} as const;

/** Interestingness, 0–1 — a "there's a story here" signal, never a rating. */
export function notability(c: Candidate): number {
  if (c.wiki) return 0.9; // has a Wikipedia / wikidata entry
  if (c.klass === "interesting") return 0.55;
  if (c.importance != null) return Math.max(0.2, Math.min(0.7, c.importance));
  return 0.2; // a plainly-named amenity
}

/**
 * A *qualitative* notability label for the UI — never a number. Maps the score
 * to a tier so the scope/sheet can show "✦ Noted" / a stronger glow without
 * ever exposing a rating.
 */
export function notabilityTier(c: Candidate): "none" | "noted" | "notable" {
  const n = notability(c);
  if (n >= TUNING.TIER_NOTABLE) return "notable";
  if (c.wiki || n >= TUNING.TIER_NOTED) return "noted";
  return "none";
}

/** Smallest absolute angle between two bearings, in degrees (0–180). */
function angleDiff(a: number, b: number): number {
  return Math.abs(((((a - b) % 360) + 540) % 360) - 180);
}

export function score(c: Candidate, ctx: ScoreCtx): Scored {
  const dist = haversine(ctx.origin.lat, ctx.origin.lon, c.lat, c.lon);

  // Cost: distance, plus a turn-around penalty that only bites when you're
  // committed to a heading (high confidence) and the place is behind you.
  const costDist = dist / TUNING.REFERENCE_M;
  let costDir = 0;
  if (ctx.travelBearing != null) {
    const toBrg = bearing(ctx.origin.lat, ctx.origin.lon, c.lat, c.lon);
    const behindness = (1 - Math.cos(toRad(angleDiff(toBrg, ctx.travelBearing)))) / 2; // 0 ahead → 1 behind
    costDir = TUNING.DIR_WEIGHT * ctx.confidence * behindness;
  }
  const cost = costDist + costDir;

  // Draw: notability, lifted by an active guide (leans, never zeroes others),
  // lowered by how familiar you already are with it.
  const guideBoost =
    ctx.activeGuide && c.category === ctx.activeGuide ? TUNING.GUIDE_BOOST : 0;
  const fam = ctx.familiarity?.(c.id) ?? 0;
  const draw = notability(c) + guideBoost - fam;

  const value = draw - cost;
  return { ...c, dist, draw, cost, value, surfaced: value >= 0 };
}

/**
 * Snap a point to a coarse grid cell — the key behind "fetch by tile, not by
 * tick" (Doc 7 Part F). Two nearby fixes share a cell, so we only re-query when
 * you cross into a new one. ~0.01° ≈ 1 km.
 */
export function cellKey(lat: number, lon: number, step = 0.01): string {
  return `${Math.round(lat / step)},${Math.round(lon / step)}`;
}

/** Stable id for a place that has no OSM ref — a rounded-coordinate hash. */
export function coordId(p: { lat: number; lon: number }): string {
  return `@${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
}

/** Score, gate (draw ≥ cost), sort by pull, and cap for the void. */
export function rankCandidates(
  cs: Candidate[],
  ctx: ScoreCtx,
  cap = 6,
): Scored[] {
  return cs
    .map((c) => score(c, ctx))
    .filter((s) => s.surfaced)
    .sort((a, b) => b.value - a.value)
    .slice(0, cap);
}
