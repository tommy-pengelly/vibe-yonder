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
  pushSaved,
  pushYonder,
  saveMap,
  updateYonder,
} from "@/lib/data";
import type {
  ActiveYonder,
  Destination,
  Fix,
  SavedYonder,
  Target,
  YonderMode,
} from "@/lib/types";
import { keepAwake } from "@/lib/wake";
import AuthModal from "./AuthModal";
import Recap from "./Recap";
import SearchScreen from "./SearchScreen";
import WalkScreen from "./WalkScreen";
import YonderComposer from "./YonderComposer";
import { useAuthUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/client";

type Phase = "search" | "composer" | "walking" | "recap";

export default function App() {
  const router = useRouter();
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
      };
      if (payload?.targets?.length) {
        void beginYonder(payload.targets, payload.mode, {
          mapId: payload.mapId,
          mapItemIdByTargetId: payload.mapItemIdByTargetId,
          name: payload.name,
        });
      }
    } catch {
      // ignore malformed payload
    }
    // beginYonder is stable across the lifetime of this component (depends only
    // on requestAccess which is stable from useHeading).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const now = Date.now();

      // If this yonder came from a saved map, write the visited mark back so
      // partial completion survives across sessions.
      const mapId = sourceMapIdRef.current;
      const mapItemId = targetToMapItemRef.current[targetId];
      if (mapId && mapItemId) {
        void (async () => {
          const map = await getMap(mapId);
          if (map) {
            await saveMap({
              ...map,
              items: map.items.map((it) =>
                it.id === mapItemId
                  ? { ...it, visited: true, visitedAt: now }
                  : it,
              ),
            });
          }
        })();
      }

      setYonder((y) => {
        if (!y) return y;
        const targets = y.targets.map((t) =>
          t.id === targetId ? { ...t, visited: true, visitedAt: now } : t,
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
      if (savedLocally) void updateYonder(next);
      return next;
    });
  }, [savedLocally]);

  const saveYonderAction = useCallback(() => {
    if (!savedYonder) return;
    void pushYonder(savedYonder);
    setSavedLocally(true);
    // Cloud sync is wired but optional; offer it only when actually available.
    if (!user && authConfigured) {
      setAuthOpen(true);
    }
  }, [savedYonder, user, authConfigured]);

  const saveForLater = useCallback(() => {
    if (!savedYonder || savedForLater) return;
    setSavedForLater(true);
    // "Save for later" on a finished yonder bookmarks its destinations so the
    // user can do them again from /you without re-searching.
    if (savedYonder.destinations.length === 1) {
      const d = savedYonder.destinations[0];
      void pushSaved({
        kind: "place",
        refId: savedYonder.id,
        name: d.name,
        lat: d.lat,
        lon: d.lon,
      });
    } else {
      void pushSaved({
        kind: "map",
        refId: savedYonder.id,
        name: savedYonder.name,
      });
    }
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
        onClose={() => router.push("/")}
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
          savedLocally={savedLocally}
          savedForLater={savedForLater}
          onRenameTitle={renameRecap}
          onNewWalk={newWalk}
          onSave={saveYonderAction}
          onDoAgain={doAgain}
          onSaveForLater={saveForLater}
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
