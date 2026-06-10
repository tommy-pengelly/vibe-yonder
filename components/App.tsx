"use client";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useHeading } from "@/hooks/useHeading";
import {
  MIN_FIX_DISTANCE_M,
  MIN_FIX_INTERVAL_MS,
  TRIVIAL_WALK_M,
} from "@/lib/constants";
import { haversine } from "@/lib/geo";
import { useSettings } from "@/lib/settings";
import { summarize } from "@/lib/stats";
import {
  getMap,
  pushYonder,
  saveMap,
  saveYonderPlaces,
  updateYonder,
} from "@/lib/data";
import type {
  ActiveYonder,
  Destination,
  Fix,
  PlayMode,
  SavedYonder,
  Target,
  YonderMode,
} from "@/lib/types";
import { scoreStraightLine } from "@/lib/straightline";
import {
  clearActiveSession,
  loadActiveSession,
  saveActiveSession,
} from "@/lib/storage";
import { keepAwake } from "@/lib/wake";
import AuthModal from "./AuthModal";
import CreateHub from "./CreateHub";
import Recap from "./Recap";
import WalkScreen from "./WalkScreen";
import { useAuthUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/client";

type Phase = "search" | "walking" | "recap";

export default function App() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("search");
  const [yonder, setYonder] = useState<ActiveYonder | null>(null);

  const [track, setTrack] = useState<Fix[]>([]);
  const [paused, setPaused] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [pausedMs, setPausedMs] = useState(0);

  const [savedYonder, setSavedYonder] = useState<SavedYonder | null>(null);
  const [savedLocally, setSavedLocally] = useState(false);
  const [savedForLater, setSavedForLater] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const lastFix = useRef<Fix | null>(null);
  const pausedAt = useRef<number | null>(null);
  const sourceMapIdRef = useRef<string | null>(null);
  const targetToMapItemRef = useRef<Record<string, string>>({});
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const { heading, requestAccess } = useHeading();
  const { settings } = useSettings();
  const { user } = useAuthUser();
  const authConfigured = isSupabaseConfigured();
  const startPayloadConsumed = useRef(false);

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
      // Straight-line: A is where you actually set off — the first real fix.
      setYonder((y) =>
        y && y.play === "straightline" && !y.origin
          ? { ...y, origin: { lat: f.lat, lon: f.lon } }
          : y,
      );
    }
  }, []);

  const { fix, error } = useGeolocation(
    phase !== "recap",
    phase === "walking" ? handleFix : undefined,
  );

  // Cross-route start handoff. /maps/[id] "Yonder this map", /favourites
  // "Start a yonder", /recap "Do again" all drop a payload here and navigate
  // to /walk; we pick it up and kick off the yonder.
  useEffect(() => {
    if (typeof window === "undefined" || startPayloadConsumed.current) return;
    const raw = window.sessionStorage.getItem("vibe-yonder.start");
    if (!raw) return;
    startPayloadConsumed.current = true;
    window.sessionStorage.removeItem("vibe-yonder.start");
    try {
      const payload = JSON.parse(raw) as {
        targets: Target[];
        mode: YonderMode;
        mapId?: string;
        mapItemIdByTargetId?: Record<string, string>;
        name?: string;
        play?: PlayMode;
        missionId?: string;
      };
      if (payload?.targets?.length || payload?.play === "ambient") {
        void beginYonder(payload.targets ?? [], payload.mode, {
          mapId: payload.mapId,
          mapItemIdByTargetId: payload.mapItemIdByTargetId,
          name: payload.name,
          play: payload.play,
          missionId: payload.missionId,
        });
      }
    } catch {
      // ignore malformed payload
    }
    // beginYonder is stable across the lifetime of this component (depends only
    // on requestAccess which is stable from useHeading).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resume an in-progress yonder after a reload or accidental exit — so a
  // dump never loses the walk (and the map) you'd set up. A fresh start
  // payload always wins over a stale session.
  useEffect(() => {
    if (typeof window === "undefined" || startPayloadConsumed.current) return;
    if (window.sessionStorage.getItem("vibe-yonder.start")) return;
    const s = loadActiveSession();
    if (!s || !s.yonder) return;
    startPayloadConsumed.current = true;
    void requestAccess();
    setYonder(s.yonder);
    setTrack(s.track ?? []);
    lastFix.current = s.track?.at(-1) ?? null;
    setStartTime(s.startTime ?? Date.now());
    setPausedMs(s.pausedMs ?? 0);
    setPaused(false);
    setEndTime(null);
    setSavedYonder(null);
    setSavedLocally(false);
    setPhase("walking");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist the live session while walking, so resume above has something to
  // restore. Cleared on finish/discard.
  useEffect(() => {
    if (phase !== "walking" || !yonder) return;
    saveActiveSession({ yonder, track, startTime, pausedMs });
  }, [phase, yonder, track, startTime, pausedMs]);

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
    async (
      targets: Target[],
      mode: YonderMode,
      opts: {
        mapId?: string;
        mapItemIdByTargetId?: Record<string, string>;
        name?: string;
        play?: PlayMode;
        missionId?: string;
      } = {},
    ) => {
      await requestAccess();
      sourceMapIdRef.current = opts.mapId ?? null;
      targetToMapItemRef.current = opts.mapItemIdByTargetId ?? {};
      const activeIndex = computeActiveIndex(targets, mode, null);
      const newYonder: ActiveYonder = {
        id: crypto.randomUUID(),
        mode,
        targets,
        activeIndex,
        name: opts.name,
        play: opts.play,
        missionId: opts.missionId,
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
    clearActiveSession();
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

  // Toggle a target's visited state (both directions: arrival chip + the
  // destinations panel). Mirrors the mark back to the source map.
  const onSetVisited = useCallback((targetId: string, visited: boolean) => {
    const stamp = visited ? Date.now() : undefined;
    const mapId = sourceMapIdRef.current;
    const mapItemId = targetToMapItemRef.current[targetId];
    if (mapId && mapItemId) {
      void (async () => {
        const map = await getMap(mapId);
        if (map) {
          await saveMap({
            ...map,
            items: map.items.map((it) =>
              it.id === mapItemId ? { ...it, visited, visitedAt: stamp } : it,
            ),
          });
        }
      })();
    }
    setYonder((y) => {
      if (!y) return y;
      const targets = y.targets.map((t) =>
        t.id === targetId ? { ...t, visited, visitedAt: stamp } : t,
      );
      const activeIndex = computeActiveIndex(targets, y.mode, y.activeIndex);
      return { ...y, targets, activeIndex };
    });
  }, []);

  // "Go next": focus a specific destination, any mode.
  const onSetActive = useCallback((targetId: string) => {
    setYonder((y) => (y ? { ...y, activeIndex: y.targets.findIndex((t) => t.id === targetId) } : y));
  }, []);

  // Remove a destination. Removing the last one drops you into a pure wander
  // (no target, just the void) — a first-class state, not an error.
  const onRemoveTarget = useCallback((targetId: string) => {
    setYonder((y) => {
      if (!y) return y;
      const prevActiveId = y.activeIndex != null ? y.targets[y.activeIndex]?.id : null;
      const targets = y.targets.filter((t) => t.id !== targetId);
      if (targets.length === 0) {
        return { ...y, targets, mode: "single", activeIndex: null };
      }
      const mode = targets.length === 1 ? "single" : y.mode;
      let activeIndex: number | null;
      if (prevActiveId && prevActiveId !== targetId) {
        const idx = targets.findIndex((t) => t.id === prevActiveId);
        activeIndex = idx >= 0 ? idx : computeActiveIndex(targets, mode, null);
      } else {
        activeIndex = computeActiveIndex(targets, mode, null);
      }
      return { ...y, targets, mode, activeIndex };
    });
  }, []);

  // Clear every destination → wander free (the purest "getting lost").
  const onClearTargets = useCallback(() => {
    setYonder((y) =>
      y ? { ...y, targets: [], mode: "single", activeIndex: null } : y,
    );
  }, []);

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
    clearActiveSession();
    const now = Date.now();
    setEndTime(now);
    setPaused(false);

    const summary = summarize(track, startTime, pausedMs, now);

    if (summary.walked < TRIVIAL_WALK_M) {
      // Trivial yonder, quietly return to search.
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

    const destinations: Destination[] =
      yonder?.targets.map((t) => ({
        name: t.name,
        label: t.label,
        lat: t.lat,
        lon: t.lon,
      })) ?? [];

    const seen = yonder?.targets.filter((t) => t.visited) ?? [];
    const autoName =
      yonder?.name ??
      (seen.length > 1
        ? `${seen.length} places`
        : (primaryTarget?.name ?? "Yonder").split(",")[0].trim());

    // Straight-line: score the track against the line A(origin)→B(target).
    const slOrigin = yonder?.origin;
    const slTarget = yonder?.targets[0];
    const straightLine =
      yonder?.play === "straightline" && slOrigin && slTarget
        ? scoreStraightLine(track, slOrigin, {
            lat: slTarget.lat,
            lon: slTarget.lon,
          })
        : undefined;

    const y: SavedYonder = {
      id: crypto.randomUUID(),
      name: autoName || "Yonder",
      mode: yonder?.mode ?? "single",
      destinations,
      startedAt: startTime ?? now,
      endedAt: now,
      durationMs: summary.durationMs,
      walked: summary.walked,
      direct: summary.direct,
      yondered: summary.yondered,
      track,
      pausedMs,
      mapId: sourceMapIdRef.current ?? undefined,
      play: yonder?.play,
      origin: slOrigin,
      straightLine,
      missionId: yonder?.missionId,
    };

    // Auto-save: a finished yonder is kept by default (cloud if signed in,
    // localStorage otherwise). No "Save" button — the recap is just for the
    // story (caption, places, visibility, do-again).
    setSavedYonder(y);
    setSavedLocally(true);
    void pushYonder(y);

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
      if (savedLocally) void updateYonder(next);
      return next;
    });
  }, [savedLocally]);

  const editCaption = useCallback(
    (caption: string) => {
      setSavedYonder((y) => {
        if (!y) return y;
        const next = { ...y, caption };
        if (savedLocally) void updateYonder(next);
        return next;
      });
    },
    [savedLocally],
  );

  const editPlaces = useCallback(
    (destinations: Destination[]) => {
      setSavedYonder((y) => {
        if (!y) return y;
        const next = { ...y, destinations };
        if (savedLocally) void updateYonder(next);
        return next;
      });
    },
    [savedLocally],
  );

  const saveForLater = useCallback(() => {
    if (!savedYonder || savedForLater) return;
    setSavedForLater(true);
    // Fold "save for later" into Maps: one place becomes a Favourite, several
    // become a Map, so the user can do them again from /maps.
    void saveYonderPlaces(savedYonder.name, savedYonder.destinations);
  }, [savedYonder, savedForLater]);

  const doAgain = useCallback(() => {
    if (!savedYonder) return;
    const targets: Target[] = savedYonder.destinations.map((d) => ({
      id: crypto.randomUUID(),
      name: d.name,
      label: d.label,
      lat: d.lat,
      lon: d.lon,
      visited: false,
    }));
    setSavedYonder(null);
    setSavedLocally(false);
    setSavedForLater(false);
    void beginYonder(targets, savedYonder.mode, {
      mapId: savedYonder.mapId,
      name: savedYonder.name,
    });
  }, [savedYonder, beginYonder]);

  void endTime;

  if (phase === "search") {
    return (
      <CreateHub
        position={fix}
        onStart={(targets, mode, opts) => void beginYonder(targets, mode, opts)}
        onClose={() => router.push("/")}
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
        onSetVisited={onSetVisited}
        onSetActive={onSetActive}
        onRemoveTarget={onRemoveTarget}
        onClearTargets={onClearTargets}
        onAddPlace={onAddPlace}
        onCalibrate={() => void requestAccess()}
      />
    );
  }

  if (phase === "recap" && savedYonder) {
    const signedInHint =
      !user && authConfigured && savedLocally
        ? "Sign in to keep this across devices."
        : null;
    return (
      <div className="relative flex-1 flex flex-col">
        <button
          type="button"
          onClick={() => router.push("/")}
          aria-label="Done"
          className="absolute top-6 left-4 z-10 size-9 rounded-full flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
        </button>
        <Recap
          saved={savedYonder}
          savedForLater={savedForLater}
          onRenameTitle={renameRecap}
          onNewWalk={newWalk}
          onDoAgain={doAgain}
          onSaveForLater={saveForLater}
          onSaveCaption={editCaption}
          onSavePlaces={editPlaces}
          signedInHint={
            signedInHint ? (
              <button
                type="button"
                onClick={() => setAuthOpen(true)}
                className="text-[var(--accent)] hover:opacity-80"
              >
                {signedInHint}
              </button>
            ) : null
          }
        />
        <AuthModal
          open={authOpen}
          reason="Create a free account to keep this yonder across devices."
          onClose={() => setAuthOpen(false)}
        />
      </div>
    );
  }

  return null;
}
