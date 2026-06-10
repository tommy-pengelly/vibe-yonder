"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { haversine } from "@/lib/geo";
import { type NearbyPlace } from "@/lib/nearby";
import type { Fix, Target } from "@/lib/types";

// A gentle mid-walk nudge toward something worth seeing nearby. The non-naggy
// contract lives here, in one place (per CLAUDE.md: never naggy, no pulsing):
//  - at most ONE offer at a time;
//  - a long cooldown between offers (and after a dismiss);
//  - dismissed places never re-offered this session;
//  - only a real detour (not somewhere you're already passing);
//  - queries are heavily throttled (kind to the public Overpass server);
//  - fully optional (enabled flag) and silent when there's nothing.

// "Things to see" — discoveries, not food/errands (that's category search).
const SEE_CATEGORIES = ["viewpoint", "art", "history", "garden", "water", "park"];

const COOLDOWN_MS = 4 * 60 * 1000; // ≥4 min between offers
const QUERY_THROTTLE_MS = 90 * 1000; // ≥90s between Overpass queries
const RADIUS_M = 400; // look this far off your path
const MIN_DETOUR_M = 40; // closer than this, you're basically there
const MAX_DETOUR_M = 320; // further than this isn't a casual detour
const OFFER_TTL_MS = 30 * 1000; // an unanswered offer fades after 30s

export type Sidequest = { place: NearbyPlace };

export function useSidequest({
  position,
  enabled,
  targets,
}: {
  position: Fix | null;
  enabled: boolean;
  targets: Target[];
}) {
  const [offer, setOffer] = useState<Sidequest | null>(null);
  // Offers you didn't answer in time — quietly auto-dismissed but kept so you
  // can glance back at what you passed up.
  const [missed, setMissed] = useState<NearbyPlace[]>([]);
  const dismissed = useRef<Set<string>>(new Set());
  const lastActionAt = useRef<number>(0); // last offer shown / dismissed
  const lastQueryAt = useRef<number>(0);
  const catIdx = useRef<number>(0);
  const busy = useRef(false);

  // Auto-dismiss an offer that's gone unanswered → move it to "missed".
  useEffect(() => {
    if (!offer) return;
    const t = setTimeout(() => {
      setMissed((m) => [offer.place, ...m].slice(0, 12));
      dismissed.current.add(offer.place.name.toLowerCase());
      setOffer(null);
      lastActionAt.current = Date.now();
    }, OFFER_TTL_MS);
    return () => clearTimeout(t);
  }, [offer]);

  useEffect(() => {
    if (!enabled || !position || offer || busy.current) return;
    const now = Date.now();
    if (now - lastActionAt.current < COOLDOWN_MS) return;
    if (now - lastQueryAt.current < QUERY_THROTTLE_MS) return;
    lastQueryAt.current = now;
    busy.current = true;

    // Rotate categories so successive offers feel varied.
    const cat = SEE_CATEGORIES[catIdx.current % SEE_CATEGORIES.length];
    catIdx.current += 1;

    const { lat, lon } = position;
    void fetch(`/api/nearby?category=${cat}&lat=${lat}&lon=${lon}&radius=${RADIUS_M}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((places: NearbyPlace[]) => {
        const pick = places
          .filter((p) => {
            const d = p.dist ?? haversine(lat, lon, p.lat, p.lon);
            if (d < MIN_DETOUR_M || d > MAX_DETOUR_M) return false;
            if (dismissed.current.has(p.name.toLowerCase())) return false;
            // Not somewhere already on the plan.
            return !targets.some(
              (t) => haversine(t.lat, t.lon, p.lat, p.lon) < 30,
            );
          })
          .sort((a, b) => (a.dist ?? 0) - (b.dist ?? 0))[0];
        if (pick) {
          setOffer({ place: pick });
          lastActionAt.current = Date.now();
        }
      })
      .catch(() => {})
      .finally(() => {
        busy.current = false;
      });
  }, [position, enabled, offer, targets]);

  const dismiss = useCallback(() => {
    setOffer((o) => {
      if (o) dismissed.current.add(o.place.name.toLowerCase());
      return null;
    });
    lastActionAt.current = Date.now();
  }, []);

  const accept = useCallback(() => {
    const taken = offer?.place ?? null;
    setOffer(null);
    lastActionAt.current = Date.now();
    return taken;
  }, [offer]);

  // Drop a place from the missed list (e.g. once acted on).
  const clearMissed = useCallback((name: string) => {
    setMissed((m) => m.filter((p) => p.name !== name));
  }, []);

  return { offer, accept, dismiss, missed, clearMissed };
}
