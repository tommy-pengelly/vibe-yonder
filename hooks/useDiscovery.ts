"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  cellKey,
  coordId,
  notability,
  notabilityTier,
  rankCandidates,
  type Candidate,
} from "@/lib/discovery";
import { haversine, makeTravelBearing } from "@/lib/geo";
import { makeFamiliarity, markSeen, markSkipped } from "@/lib/discovery-ledger";
import { summarize } from "@/lib/stats";
import type { NearbyPlace } from "@/lib/nearby";
import type { Fix, Target } from "@/lib/types";

// The ambient discovery engine at runtime (Doc 7). Maintains a scored pool of
// nearby places and surfaces a sparse, capped set for the scope. The cadence
// discipline mirrors useSidequest, and the "fetch by tile not by tick" rule
// (Doc 7 Part F) is enforced by only querying when you cross a grid cell.

const STEP = 0.01; // ~1 km tile
const QUERY_THROTTLE_MS = 60 * 1000; // floor between cell-move refetches
const ON_CANVAS_CAP = 12; // keep the void uncluttered, but it's a constellation
const POOL_CAP = 80; // bound memory; farthest pruned

export type ScopeCandidate = {
  id: string;
  lat: number;
  lon: number;
  dist: number;
  name?: string;
  category?: string;
  /** Wikidata type label ("Statue", "Listed building"), when known. */
  typeLabel?: string;
  /** Wikipedia title or Wikidata id, drives the entity-accurate photo/blurb. */
  wiki?: string;
  /** 0–1 continuous notability. Drives the star's brightness + size. */
  notability: number;
  /** Matches the active lens/guide ⇒ tinted (violet) in the constellation. */
  matchesLens?: boolean;
  tier: "none" | "noted" | "notable";
};

/** A rosy "lots to see here" glow: a patch of sky where the *pool* is dense,
 * even if few places are individually notable. Drawn under the stars as a stack
 * of soft blobs at its member points, so its shape follows the real cluster
 * (an organic cloud, never a perfect disc). Density, NOT notability, drives it. */
export type Nebula = {
  /** Centroid, for off-screen culling. */
  lat: number;
  lon: number;
  /** Spread of the cluster (m), scales the blob size. */
  radiusM: number;
  /** Member count, the "how much to see" weight. */
  weight: number;
  /** The places that make up the cloud, its shape. Capped for cost. */
  points: { lat: number; lon: number }[];
};

const NEBULA_CELL = 0.0025; // ~250 m bin
const NEBULA_MIN = 4; // this many places in a bin ⇒ worth a wander
const NEBULA_POINTS_CAP = 16; // bound the blobs we draw per cloud

// Bin the whole pool by coarse cells; any cell dense enough becomes a nebula
// carrying its member points (the cloud's shape) + spread.
function computeNebulae(cs: Candidate[]): Nebula[] {
  const bins = new Map<string, Candidate[]>();
  for (const c of cs) {
    const k = `${Math.round(c.lat / NEBULA_CELL)},${Math.round(c.lon / NEBULA_CELL)}`;
    const b = bins.get(k);
    if (b) b.push(c);
    else bins.set(k, [c]);
  }
  const out: Nebula[] = [];
  for (const group of bins.values()) {
    if (group.length < NEBULA_MIN) continue;
    const lat = group.reduce((s, c) => s + c.lat, 0) / group.length;
    const lon = group.reduce((s, c) => s + c.lon, 0) / group.length;
    let spread = 0;
    for (const c of group) spread = Math.max(spread, haversine(lat, lon, c.lat, c.lon));
    out.push({
      lat,
      lon,
      radiusM: Math.max(180, spread),
      weight: group.length,
      points: group.slice(0, NEBULA_POINTS_CAP).map((c) => ({ lat: c.lat, lon: c.lon })),
    });
  }
  return out.sort((a, b) => b.weight - a.weight).slice(0, 3);
}

function toCandidate(p: NearbyPlace): Candidate {
  return { ...p, id: p.id ?? coordId(p) };
}

export function useDiscovery({
  position,
  track,
  enabled,
  activeGuide,
  committedIds,
}: {
  position: Fix | null;
  track: Fix[];
  enabled: boolean;
  activeGuide: string | null;
  committedIds: Set<string>;
}): {
  candidates: ScopeCandidate[];
  nebulae: Nebula[];
  skip: (id: string) => void;
  commit: (id: string) => Target | null;
} {
  const pool = useRef<Map<string, Candidate>>(new Map());
  const tb = useRef(makeTravelBearing());
  const lastFetchKey = useRef<string | null>(null);
  const lastQueryAt = useRef(0);
  const busy = useRef(false);
  const [candidates, setCandidates] = useState<ScopeCandidate[]>([]);
  const [nebulae, setNebulae] = useState<Nebula[]>([]);

  // Latest props via refs, so the stable callbacks/effects below don't churn on
  // a caller that rebuilds `track`/`committedIds` every render.
  const trackRef = useRef(track);
  trackRef.current = track;
  const committedRef = useRef(committedIds);
  committedRef.current = committedIds;

  const distTravelled = () => summarize(trackRef.current, null, 0).walked;

  // Re-score the pool against the current position/heading/ledger and project a
  // capped, gated set onto the scope. Pure read of the pool ref.
  const rescore = useCallback(() => {
    if (!position) {
      setCandidates([]);
      setNebulae([]);
      return;
    }
    const { bearing, confidence } = tb.current.value();
    const familiarity = makeFamiliarity(distTravelled());
    const all = [...pool.current.values()].filter(
      (c) => !committedRef.current.has(c.id),
    );
    setNebulae(computeNebulae(all));
    const scored = rankCandidates(
      all,
      {
        origin: { lat: position.lat, lon: position.lon },
        travelBearing: bearing,
        confidence,
        activeGuide,
        familiarity,
      },
      ON_CANVAS_CAP,
    );
    setCandidates(
      scored.map((s) => ({
        id: s.id,
        lat: s.lat,
        lon: s.lon,
        dist: s.dist,
        notability: notability(s),
        // Violet ONLY when the place itself is the kind you filtered for. A
        // themed fetch still returns the general interesting/notable rings
        // (parks, landmarks…) alongside the theme, so keying off "was fetched
        // under the lens" tinted everything; key off the place's own category.
        matchesLens: activeGuide != null && s.category === activeGuide,
        tier: notabilityTier(s),
        name: s.name,
        category: s.category,
        typeLabel: s.typeLabel,
        wiki: s.wiki,
      })),
    );
  }, [position, activeGuide]);

  // Tile fetch: only when we cross into a new cell (or the guide changes), and
  // never faster than the throttle. This is the whole cost story, see Part F.
  useEffect(() => {
    if (!enabled || !position || busy.current) return;
    const key = `${cellKey(position.lat, position.lon, STEP)}|${activeGuide ?? ""}`;
    if (key === lastFetchKey.current) return;
    const guideChanged =
      lastFetchKey.current != null &&
      lastFetchKey.current.split("|")[1] !== (activeGuide ?? "");
    const now = Date.now();
    if (!guideChanged && now - lastQueryAt.current < QUERY_THROTTLE_MS) return;

    busy.current = true;
    lastQueryAt.current = now;
    lastFetchKey.current = key;
    const { lat, lon } = position;
    const lens = activeGuide ?? "";
    const guide = lens ? `&theme=${lens}` : "";
    void fetch(`/api/nearby?scope=ambient&lat=${lat}&lon=${lon}${guide}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((places: NearbyPlace[]) => {
        for (const p of places) {
          const c = toCandidate(p);
          if (lens) c.lensTheme = lens; // tag what lens surfaced it (violet tint)
          if (!committedRef.current.has(c.id)) pool.current.set(c.id, c);
        }
        prunePool(pool.current, lat, lon);
        rescore();
      })
      .catch(() => {})
      .finally(() => {
        busy.current = false;
      });
  }, [enabled, position, activeGuide, rescore]);

  // Re-score on every fix (cheap) so dots track you and reveal on approach.
  useEffect(() => {
    if (!enabled) {
      setCandidates([]);
      setNebulae([]);
      return;
    }
    if (position) tb.current.push(position);
    rescore();
  }, [enabled, position, rescore]);

  const skip = useCallback((id: string) => {
    pool.current.delete(id);
    markSkipped(id, distTravelled());
    setCandidates((cs) => cs.filter((c) => c.id !== id));
  }, []);

  const commit = useCallback((id: string): Target | null => {
    const c = pool.current.get(id);
    if (!c) return null;
    pool.current.delete(id);
    markSeen(id, distTravelled());
    setCandidates((cs) => cs.filter((x) => x.id !== id));
    return {
      id: crypto.randomUUID(),
      name: c.name,
      label: "",
      lat: c.lat,
      lon: c.lon,
      visited: false,
    };
  }, []);

  return { candidates, nebulae, skip, commit };
}

/** Bound the pool: drop the farthest places once it's oversized. */
function prunePool(pool: Map<string, Candidate>, lat: number, lon: number) {
  if (pool.size <= POOL_CAP) return;
  const byDist = [...pool.values()].sort(
    (a, b) => haversine(lat, lon, a.lat, a.lon) - haversine(lat, lon, b.lat, b.lon),
  );
  pool.clear();
  for (const c of byDist.slice(0, POOL_CAP)) pool.set(c.id, c);
}
