"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useHeading } from "@/hooks/useHeading";
import { haversine } from "@/lib/geo";
import type { Destination, Fix, Journey, Poi } from "@/lib/types";
import { keepAwake } from "@/lib/wake";
import JourneyBuilder from "./JourneyBuilder";
import Recap from "./Recap";
import SearchScreen from "./SearchScreen";
import WalkScreen from "./WalkScreen";

type Phase = "search" | "journey-setup" | "walking" | "recap";

const MIN_FIX_DISTANCE_M = 3;
const MIN_FIX_INTERVAL_MS = 3000;
const DEFAULT_MPP = 0.6;
const JOURNEY_STORAGE_KEY = "vibe-yonder.journey";
const EMPTY_POIS: Poi[] = [];

export default function App() {
  const [phase, setPhase] = useState<Phase>("search");
  const [destination, setDestination] = useState<Destination | null>(null);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [pendingWaypoints, setPendingWaypoints] = useState<Destination[]>([]);
  const [track, setTrack] = useState<Fix[]>([]);
  const [paused, setPaused] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [pausedMs, setPausedMs] = useState(0);
  const mpp = DEFAULT_MPP;
  const pois: Poi[] = EMPTY_POIS;

  const lastFix = useRef<Fix | null>(null);
  const pausedAt = useRef<number | null>(null);
  const { heading, requestAccess } = useHeading();
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(JOURNEY_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Destination[];
      if (Array.isArray(parsed)) setPendingWaypoints(parsed);
    } catch {
      // ignore corrupt persisted state
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pendingWaypoints.length === 0) {
      window.localStorage.removeItem(JOURNEY_STORAGE_KEY);
    } else {
      window.localStorage.setItem(
        JOURNEY_STORAGE_KEY,
        JSON.stringify(pendingWaypoints),
      );
    }
  }, [pendingWaypoints]);

  const handleFix = useCallback((f: Fix) => {
    if (pausedRef.current) return;
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

  const { fix, error } = useGeolocation(
    phase === "walking" || phase === "search" || phase === "journey-setup",
    phase === "walking" ? handleFix : undefined,
  );

  useEffect(() => {
    if (phase !== "walking") return;
    void keepAwake(!paused);
    const onVis = () => {
      if (document.visibilityState === "visible" && !paused) {
        void keepAwake(true);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      void keepAwake(false);
    };
  }, [phase, paused]);

  const beginWalk = useCallback(
    async (d: Destination, opts: { journey: Journey | null }) => {
      await requestAccess();
      setDestination(d);
      setJourney(opts.journey);
      setTrack([]);
      lastFix.current = null;
      pausedAt.current = null;
      setPausedMs(0);
      setPaused(false);
      setStartTime(Date.now());
      setEndTime(null);
      setPhase("walking");
    },
    [requestAccess],
  );

  const startSinglePick = useCallback(
    (d: Destination) => {
      void beginWalk(d, { journey: null });
    },
    [beginWalk],
  );

  const startJourney = useCallback(() => {
    if (pendingWaypoints.length === 0) return;
    const j: Journey = {
      name: pendingWaypoints[0].name,
      waypoints: pendingWaypoints,
      activeIndex: 0,
    };
    void beginWalk(pendingWaypoints[0], { journey: j });
  }, [beginWalk, pendingWaypoints]);

  const advanceJourney = useCallback(() => {
    setJourney((j) => {
      if (!j) return j;
      const next = j.activeIndex + 1;
      if (next >= j.waypoints.length) {
        setEndTime(Date.now());
        setPhase("recap");
        return j;
      }
      const nextWaypoint = j.waypoints[next];
      setDestination(nextWaypoint);
      return { ...j, activeIndex: next };
    });
  }, []);

  const pause = useCallback(() => {
    pausedAt.current = Date.now();
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    if (pausedAt.current != null) {
      setPausedMs((ms) => ms + (Date.now() - (pausedAt.current ?? Date.now())));
      pausedAt.current = null;
    }
    setPaused(false);
  }, []);

  const finish = useCallback(() => {
    if (pausedAt.current != null) {
      setPausedMs((ms) => ms + (Date.now() - (pausedAt.current ?? Date.now())));
      pausedAt.current = null;
    }
    setEndTime(Date.now());
    setPaused(false);
    setPhase("recap");
    if (journey) {
      setPendingWaypoints([]);
    }
  }, [journey]);

  const cancel = useCallback(() => {
    pausedAt.current = null;
    setPaused(false);
    setPhase("search");
    setDestination(null);
    setJourney(null);
    setTrack([]);
    lastFix.current = null;
    setStartTime(null);
    setEndTime(null);
    setPausedMs(0);
  }, []);

  const reset = useCallback(() => {
    cancel();
  }, [cancel]);

  const addPendingWaypoint = useCallback((d: Destination) => {
    setPendingWaypoints((ws) => [...ws, d]);
  }, []);

  const removePendingWaypoint = useCallback((idx: number) => {
    setPendingWaypoints((ws) => ws.filter((_, i) => i !== idx));
  }, []);

  const movePendingWaypoint = useCallback((idx: number, dir: -1 | 1) => {
    setPendingWaypoints((ws) => {
      const next = [...ws];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return ws;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }, []);

  const clearPendingWaypoints = useCallback(() => {
    setPendingWaypoints([]);
  }, []);

  if (phase === "search") {
    return (
      <SearchScreen
        position={fix}
        onPick={startSinglePick}
        onAddToJourney={(d) => {
          addPendingWaypoint(d);
          setPhase("journey-setup");
        }}
        onOpenJourneyBuilder={() => setPhase("journey-setup")}
        journeyCount={pendingWaypoints.length}
      />
    );
  }

  if (phase === "journey-setup") {
    return (
      <JourneyBuilder
        waypoints={pendingWaypoints}
        position={fix}
        onAdd={addPendingWaypoint}
        onRemove={removePendingWaypoint}
        onMove={movePendingWaypoint}
        onClear={clearPendingWaypoints}
        onStart={startJourney}
        onBack={() => setPhase("search")}
      />
    );
  }

  if (phase === "walking" && destination) {
    return (
      <WalkScreen
        destination={destination}
        journey={journey}
        position={fix}
        heading={heading}
        track={track}
        pois={pois}
        startTime={startTime}
        pausedMs={pausedMs}
        paused={paused}
        geoError={error}
        mpp={mpp}
        onPause={pause}
        onResume={resume}
        onFinish={finish}
        onCancel={cancel}
        onAdvanceJourney={advanceJourney}
      />
    );
  }

  if (phase === "recap" && destination) {
    return (
      <Recap
        destination={destination}
        track={track}
        startTime={startTime}
        pausedMs={pausedMs}
        endTime={endTime}
        onReset={reset}
      />
    );
  }

  return null;
}
