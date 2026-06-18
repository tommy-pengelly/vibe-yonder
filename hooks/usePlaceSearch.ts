"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { matchFavourites, mergeFavouritesFirst, rankResults } from "@/lib/rank";
import type { FavouritePlace, Fix, GeocodeResult, RankedResult } from "@/lib/types";

/**
 * Debounced place search against /api/geocode, ranked by distance from
 * `position`. Replaces the geocode-fetch pattern that was duplicated across the
 * search, composer, add-place sheet, and map editor.
 *
 * Pass `favourites` to resolve saved-place aliases: typing "home" surfaces the
 * user's Home at the top, before (and instead of duplicating) geocode hits, and
 * at any query length.
 */
export function usePlaceSearch(
  position: Fix | null,
  favourites: FavouritePlace[] = [],
  /** Nearby-POI search radius (m). Omit for the route default (1500). Changing
   * it re-runs the search, so a "search wider" control can widen the net. */
  radius?: number,
) {
  const [q, setQ] = useState("");
  const [geo, setGeo] = useState<RankedResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const favMatches = useMemo(
    () => matchFavourites(q, favourites, position),
    [q, favourites, position],
  );
  const results = useMemo(
    () => mergeFavouritesFirst(favMatches, geo),
    [favMatches, geo],
  );

  // Read position via a ref so a moving GPS fix doesn't re-fire the search on
  // every tick, we only want a new request when the *query* changes (queries
  // still get proximity bias from the latest position).
  const posRef = useRef(position);
  posRef.current = position;

  useEffect(() => {
    const term = q.trim();
    if (term.length < 3) {
      setGeo([]);
      setError(null);
      setLoading(false);
      return;
    }
    const myReq = ++reqId.current;
    setLoading(true);
    const handle = setTimeout(async () => {
      const pos = posRef.current;
      try {
        const near = pos ? `&lat=${pos.lat}&lon=${pos.lon}` : "";
        const rad = radius ? `&radius=${radius}` : "";
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(term)}${near}${rad}`);
        if (myReq !== reqId.current) return;
        if (!res.ok) {
          setError("Search failed");
          setGeo([]);
          return;
        }
        const data = (await res.json()) as GeocodeResult[];
        setGeo(rankResults(data, pos));
        setError(null);
      } catch {
        if (myReq === reqId.current) {
          setError("Search failed");
          setGeo([]);
        }
      } finally {
        if (myReq === reqId.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [q, radius]);

  const reset = () => {
    setQ("");
    setGeo([]);
    setError(null);
    setLoading(false);
  };

  return { q, setQ, results, loading, error, reset };
}
