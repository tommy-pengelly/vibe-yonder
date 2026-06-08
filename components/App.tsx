"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useHeading } from "@/hooks/useHeading";
import { haversine } from "@/lib/geo";
import { useSettings } from "@/lib/settings";
import { summarize } from "@/lib/stats";
import { pushYonder, updateYonder } from "@/lib/storage";
import type {
  ActiveYonder,
  Destination,
  Fix,
  SavedYonder,
  Target,
  YonderMode,
} from "@/lib/types";
import { keepAwake } from "@/lib/wake";
import Recap from "./Recap";
import SearchScreen from "./SearchScreen";
import WalkScreen from "./WalkScreen";
import YonderComposer from "./YonderComposer";

type Phase = "search" | "composer" | "walking" | "recap";

const MIN_FIX_DISTANCE_M = 3;
const MIN_FIX_INTERVAL_MS = 3000;
const TRIVIAL_WALK_M = 30;

export default function App() {
  const [phase, setPhase] = useState<Phase>("search");
  const [yonder, setYonder] = useState<ActiveYonder | null>(null);
  const [composerSeed, setComposerSeed] = useState<Target[]>([]);

  const [track, setTrack] = useState<Fix[]>([]);
  const [paused, setPaused] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [pausedMs, setPausedMs] = useState(0);

  const [savedYonder, setSavedYonder] = useState<SavedYonder | null>(null);
  const [savedLocally, setSavedLocally] = useState(false);

  const lastFix = useRef<Fix | null>(null);
  const pausedAt = useRef<number | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const { heading, requestAccess } = useHeading();
  const { settings } = useSettings();

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
    phase !== "recap",
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

  const flushPausedAt = useCallback(() => {
    if (pausedAt.current != null) {
      const delta = Date.now() - pausedAt.current;
      pausedAt.current = null;
      setPausedMs((ms) => ms + delta);
    }
  }, []);

  const computeActiveIndex = (
    targets: Target[],
    mode: YonderMode,
    previousActive: number | null,
  ): number | null => {
    if (targets.length === 0) return null;
    if (mode === "single") return 0;
    if (mode === "collection") return null;
    // ordered
    if (previousActive != null && !targets[previousActive]?.visited) {
      return previousActive;
    }
    const next = targets.findIndex((t) => !t.visited);
    return next >= 0 ? next : null;
  };

  const beginYonder = useCallback(
    async (targets: Target[], mode: YonderMode) => {
      await requestAccess();
      const activeIndex = computeActiveIndex(targets, mode, null);
      const newYonder: ActiveYonder = {
        id: crypto.randomUUID(),
        mode,
        targets,
        activeIndex,
        name: undefined,
      };
      setYonder(newYonder);
      setTrack([]);
      lastFix.current = null;
      pausedAt.current = null;
      setPausedMs(0);
      setPaused(false);
      setStartTime(Date.now());
      setEndTime(null);
      setSavedYonder(null);
      setSavedLocally(false);
      setPhase("walking");
    },
    [requestAccess],
  );

  const pause = useCallback(() => {
    pausedAt.current = Date.now();
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    flushPausedAt();
    setPaused(false);
  }, [flushPausedAt]);

  const discard = useCallback(() => {
    void keepAwake(false);
    pausedAt.current = null;
    setPaused(false);
    setYonder(null);
    setTrack([]);
    lastFix.current = null;
    setStartTime(null);
    setEndTime(null);
    setPausedMs(0);
    setSavedYonder(null);
    setSavedLocally(false);
    setPhase("search");
  }, []);

  const onArrivalConfirm = useCallback(
    (targetId: string, visited: boolean) => {
      if (!visited) return;
      setYonder((y) => {
        if (!y) return y;
        const now = Date.now();
        const targets = y.targets.map((t) =>
          t.id === targetId
            ? { ...t, visited: true, visitedAt: now }
            : t,
        );
        const activeIndex = computeActiveIndex(targets, y.mode, y.activeIndex);
        return { ...y, targets, activeIndex };
      });
    },
    [],
  );

  const onAddPlace = useCallback((target: Target) => {
    setYonder((y) => {
      if (!y) return y;
      const targets = [...y.targets, target];
      let mode = y.mode;
      if (mode === "single" && targets.length > 1) mode = "collection";
      const allWereVisited = y.targets.every((t) => t.visited);
      let activeIndex = y.activeIndex;
      if (mode === "collection") {
        activeIndex = null;
      } else if (mode === "ordered") {
        if (activeIndex == null || allWereVisited) {
          activeIndex = targets.length - 1;
        }
      } else {
        activeIndex = 0;
      }
      return { ...y, targets, mode, activeIndex };
    });
  }, []);

  const finish = useCallback(() => {
    flushPausedAt();
    const now = Date.now();
    setEndTime(now);
    setPaused(false);

    const summary = summarize(track, startTime, pausedMs, now);

    if (summary.walked < TRIVIAL_WALK_M) {
      // Trivial yonder — quietly return to search.
      void keepAwake(false);
      setYonder(null);
      setTrack([]);
      lastFix.current = null;
      setStartTime(null);
      setEndTime(null);
      setPausedMs(0);
      setSavedYonder(null);
      setSavedLocally(false);
      setPhase("search");
      return;
    }

    const primaryTarget =
      yonder?.targets.find((_, i) => i === yonder.activeIndex) ??
      yonder?.targets[0] ??
      null;
    const destForRecap: Destination = primaryTarget
      ? {
          name: primaryTarget.name,
          label: primaryTarget.label,
          lat: primaryTarget.lat,
          lon: primaryTarget.lon,
        }
      : {
          name: "Yonder",
          lat: track.at(-1)?.lat ?? 0,
          lon: track.at(-1)?.lon ?? 0,
        };

    const seen = yonder?.targets.filter((t) => t.visited) ?? [];
    const autoName =
      yonder?.name ??
      (seen.length > 1
        ? `${seen.length} places`
        : (primaryTarget?.name ?? "Yonder").split(",")[0].trim());

    const y: SavedYonder = {
      id: crypto.randomUUID(),
      name: autoName || "Yonder",
      startedAt: startTime ?? now,
      endedAt: now,
      durationMs: summary.durationMs,
      walked: summary.walked,
      direct: summary.direct,
      yondered: summary.yondered,
      track,
      pausedMs,
      destination: destForRecap,
    };

    setSavedYonder(y);
    setSavedLocally(false);

    void keepAwake(false);
    setPhase("recap");
  }, [
    flushPausedAt,
    pausedMs,
    startTime,
    track,
    yonder,
  ]);

  const newWalk = useCallback(() => {
    setYonder(null);
    setTrack([]);
    lastFix.current = null;
    setStartTime(null);
    setEndTime(null);
    setPausedMs(0);
    setSavedYonder(null);
    setSavedLocally(false);
    setPhase("search");
  }, []);

  const renameRecap = useCallback((name: string) => {
    setSavedYonder((y) => {
      if (!y) return y;
      const next = { ...y, name };
      if (savedLocally) updateYonder(next);
      return next;
    });
  }, [savedLocally]);

  const saveLocally = useCallback(() => {
    if (!savedYonder) return;
    pushYonder(savedYonder);
    setSavedLocally(true);
  }, [savedYonder]);

  const openComposer = useCallback((seed: Target | null) => {
    setComposerSeed(seed ? [seed] : []);
    setPhase("composer");
  }, []);

  void endTime;

  if (phase === "search") {
    return (
      <SearchScreen
        position={fix}
        onPickSingle={(target) => void beginYonder([target], "single")}
        onComposeMulti={openComposer}
      />
    );
  }

  if (phase === "composer") {
    return (
      <YonderComposer
        initial={composerSeed}
        position={fix}
        onStart={(targets, mode) => void beginYonder(targets, mode)}
        onCancel={() => setPhase("search")}
      />
    );
  }

  if (phase === "walking" && yonder) {
    return (
      <WalkScreen
        yonder={yonder}
        position={fix}
        heading={heading}
        track={track}
        startTime={startTime}
        pausedMs={pausedMs}
        paused={paused}
        geoError={error}
        hideNumbers={settings.hideNumbers}
        onPause={pause}
        onResume={resume}
        onFinish={finish}
        onDiscard={discard}
        onArrivalConfirm={onArrivalConfirm}
        onAddPlace={onAddPlace}
        onCalibrate={() => void requestAccess()}
      />
    );
  }

  if (phase === "recap" && savedYonder) {
    return (
      <Recap
        saved={savedYonder}
        savedLocally={savedLocally}
        onRenameTitle={renameRecap}
        onNewWalk={newWalk}
        onSave={saveLocally}
      />
    );
  }

  return null;
}
