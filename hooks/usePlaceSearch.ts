"use client";
import { useEffect, useRef, useState } from "react";
import { rankResults } from "@/lib/rank";
import type { Fix, GeocodeResult, RankedResult } from "@/lib/types";

/**
 * Debounced place search against /api/geocode, ranked by distance from
 * `position`. Replaces the geocode-fetch pattern that was duplicated across the
 * search, composer, add-place sheet, and map editor.
 */
export function usePlaceSearch(position: Fix | null) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<RankedResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  // Read position via a ref so a moving GPS fix doesn't re-fire the search on
  // every tick — we only want a new request when the *query* changes (queries
  // still get proximity bias from the latest position).
  const posRef = useRef(position);
  posRef.current = position;

  useEffect(() => {
    const term = q.trim();
    if (term.length < 3) {
      setResults([]);
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
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(term)}${near}`);
        if (myReq !== reqId.current) return;
        if (!res.ok) {
          setError("Search failed");
          setResults([]);
          return;
        }
        const data = (await res.json()) as GeocodeResult[];
        setResults(rankResults(data, pos));
        setError(null);
      } catch {
        if (myReq === reqId.current) {
          setError("Search failed");
          setResults([]);
        }
      } finally {
        if (myReq === reqId.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [q]);

  const reset = () => {
    setQ("");
    setResults([]);
    setError(null);
    setLoading(false);
  };

  return { q, setQ, results, loading, error, reset };
}
