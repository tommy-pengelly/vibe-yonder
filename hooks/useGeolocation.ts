"use client";
import { useEffect, useRef, useState } from "react";
import type { Fix } from "@/lib/types";

export type GeoError = "permission-denied" | "unavailable" | "timeout";

export function useGeolocation(active: boolean, onFix?: (f: Fix) => void) {
  const [fix, setFix] = useState<Fix | null>(null);
  const [error, setError] = useState<GeoError | null>(null);
  const cb = useRef(onFix);
  cb.current = onFix;

  useEffect(() => {
    if (!active) return;
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setError("unavailable");
      return;
    }
    setError(null);
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const f: Fix = {
          lat: p.coords.latitude,
          lon: p.coords.longitude,
          acc: p.coords.accuracy ?? null,
          alt: p.coords.altitude ?? null,
          t: Date.now(),
        };
        setFix(f);
        cb.current?.(f);
      },
      (e) => {
        if (e.code === 1) setError("permission-denied");
        else if (e.code === 3) setError("timeout");
        else setError("unavailable");
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [active]);

  return { fix, error };
}
