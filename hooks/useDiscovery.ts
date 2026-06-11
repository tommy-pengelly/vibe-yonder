"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  cellKey,
  coordId,
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
const REVEAL_M = 60; // within this, a mystery dot resolves to its name
const ON_CANVAS_CAP = 6; // keep the void uncluttered
const POOL_CAP = 80; // bound memory; farthest pruned

export type ScopeCandidate = {
  id: string;
  lat: number;
  lon: number;
  dist: number;
  /** Within REVEAL_M, show its name/category; otherwise a faint mystery dot. */
  revealed: boolean;
  name?: string;
  category?: string;
  wiki?: string;
  tier: "none" | "noted" | "notable";
};

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
  skip: (id: string) => void;
  commit: (id: string) => Target | null;
} {
  const pool = useRef<Map<string, Candidate>>(new Map());
  const tb = useRef(makeTravelBearing());
  const lastFetchKey = useRef<string | null>(null);
  const lastQueryAt = useRef(0);
  const busy = useRef(false);
  const [candidates, setCandidates] = useState<ScopeCandidate[]>([]);

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
      return;
    }
    const { bearing, confidence } = tb.current.value();
    const familiarity = makeFamiliarity(distTravelled());
    const all = [...pool.current.values()].filter(
      (c) => !committedRef.current.has(c.id),
    );
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
        // `revealed` gates the on-scope label (mystery dots until you're close);
        // the full name/category travel with it so the suggestions sheet, the
        // deliberate "show me what's around" view, can display them.
        revealed: s.dist < REVEAL_M,
        tier: notabilityTier(s),
        name: s.name,
        category: s.category,
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
    const guide = activeGuide ? `&category=${activeGuide}` : "";
    void fetch(`/api/nearby?scope=ambient&lat=${lat}&lon=${lon}${guide}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((places: NearbyPlace[]) => {
        for (const p of places) {
          const c = toCandidate(p);
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

  return { candidates, skip, commit };
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
