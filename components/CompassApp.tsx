"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useHeading } from "@/hooks/useHeading";
import { haversine } from "@/lib/geo";
import type { Destination, Fix } from "@/lib/types";
import SearchScreen from "./SearchScreen";
import Compass from "./Compass";
import Recap from "./Recap";

type Phase = "search" | "walking" | "recap";

const MIN_FIX_DISTANCE_M = 4;
const MIN_FIX_INTERVAL_MS = 4000;
const HEADING_FALLBACK_MS = 2500;

export default function CompassApp() {
  const [phase, setPhase] = useState<Phase>("search");
  const [destination, setDestination] = useState<Destination | null>(null);
  const [track, setTrack] = useState<Fix[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [headingAvailable, setHeadingAvailable] = useState(false);

  const lastFix = useRef<Fix | null>(null);
  const { heading, requestAccess } = useHeading();

  const handleFix = useCallback((f: Fix) => {
    const prev = lastFix.current;
    if (
      !prev ||
      haversine(prev.lat, prev.lon, f.lat, f.lon) > MIN_FIX_DISTANCE_M ||
      f.t - prev.t > MIN_FIX_INTERVAL_MS
    ) {
      lastFix.current = f;
      setTrack((t) => [...t, f]);
    }
  }, []);

  const { fix, error } = useGeolocation(phase === "walking", handleFix);

  useEffect(() => {
    if (phase !== "walking") {
      setHeadingAvailable(false);
      return;
    }
    if (heading != null) {
      setHeadingAvailable(true);
      return;
    }
    const t = setTimeout(() => {
      if (heading == null) setHeadingAvailable(false);
    }, HEADING_FALLBACK_MS);
    return () => clearTimeout(t);
  }, [phase, heading]);

  const startWalk = useCallback(
    async (d: Destination) => {
      await requestAccess();
      setDestination(d);
      setTrack([]);
      lastFix.current = null;
      setStartTime(Date.now());
      setPhase("walking");
    },
    [requestAccess],
  );

  const finish = useCallback(() => {
    setPhase("recap");
  }, []);

  const cancel = useCallback(() => {
    setPhase("search");
    setDestination(null);
    setTrack([]);
    lastFix.current = null;
    setStartTime(null);
  }, []);

  const reset = useCallback(() => {
    setPhase("search");
    setDestination(null);
    setTrack([]);
    lastFix.current = null;
    setStartTime(null);
  }, []);

  if (phase === "search") {
    return <SearchScreen onPick={startWalk} />;
  }

  if (phase === "walking" && destination) {
    return (
      <Compass
        destination={destination}
        position={fix}
        heading={heading}
        headingAvailable={headingAvailable}
        geoError={error}
        onFinish={finish}
        onCancel={cancel}
      />
    );
  }

  if (phase === "recap" && destination) {
    return (
      <Recap
        destination={destination}
        track={track}
        startTime={startTime}
        onReset={reset}
      />
    );
  }

  return null;
}
