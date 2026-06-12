"use client";
import {
  ExternalLink,
  Heart,
  ListChecks,
  Locate,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDiscovery } from "@/hooks/useDiscovery";
import { usePlaceSearch } from "@/hooks/usePlaceSearch";
import SuggestionsSheet from "@/components/SuggestionsSheet";
import { getFavourite, pushFavourite, removeFavourite } from "@/lib/data";
import {
  ARRIVAL_RADIUS_M,
  ARRIVAL_REARM_RATIO,
  DEFAULT_MPP,
  MAX_MPP,
  MIN_MPP,
  RIM_FRACTION,
  SCALE_LEVELS_M,
} from "@/lib/constants";
import { haversine, fmtDist } from "@/lib/geo";
import { directionsOptions } from "@/lib/maps";
import { DISCOVERY_ENABLED } from "@/lib/flags";
import type {
  ActiveYonder,
  Fix,
  Target,
} from "@/lib/types";
import Scope from "./Scope";
import StatStrip from "./StatStrip";
import BottomSheet from "./ui/BottomSheet";
import CalibrateHint from "./walk/CalibrateHint";
import WalkControls from "./walk/WalkControls";
import WalkHeader from "./walk/WalkHeader";

type Props = {
  yonder: ActiveYonder;
  position: Fix | null;
  heading: number | null;
  track: Fix[];
  startTime: number | null;
  pausedMs: number;
  paused: boolean;
  geoError: string | null;
  hideNumbers: boolean;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  onDiscard: () => void;
  onSetVisited: (targetId: string, visited: boolean) => void;
  onSetActive: (targetId: string) => void;
  onRemoveTarget: (targetId: string) => void;
  onClearTargets: () => void;
  onAddPlace: (target: Target) => void;
  onCalibrate: () => void;
};

export default function WalkScreen({
  yonder,
  position,
  heading,
  track,
  startTime,
  pausedMs,
  paused,
  geoError,
  hideNumbers,
  onPause,
  onResume,
  onFinish,
  onDiscard,
  onClearTargets,
  onSetVisited,
  onSetActive,
  onRemoveTarget,
  onAddPlace,
  onCalibrate,
}: Props) {
  const [mpp, setMpp] = useState(DEFAULT_MPP);
  const [arrivalQueue, setArrivalQueue] = useState<string[]>([]);
  const [dismissedArrivals, setDismissedArrivals] = useState<
    Record<string, boolean>
  >({});
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [directionsOpen, setDirectionsOpen] = useState(false);

  // Discovery, the single suggestions engine (replaces the old sidequest).
  // Faint candidate dots populate the scope (the eyes-up constellation); the
  // suggestions sheet is the deliberate "show me what's around" view. A guide
  // leans what surfaces. Gated behind DISCOVERY_ENABLED (off by default while the
  // taste is reworked); when off, every discovery seam below no-ops and the
  // wander stays a clean void. Silenceable per-walk when on.
  const [suggestionsOn, setSuggestionsOn] = useState(DISCOVERY_ENABLED);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeGuide, setActiveGuide] = useState<string | null>(null);
  const committedIds = useMemo(
    () => new Set(yonder.targets.map((t) => t.id)),
    [yonder.targets],
  );
  const {
    candidates,
    skip: skipCandidate,
    commit: commitCandidate,
  } = useDiscovery({
    position,
    track,
    enabled: DISCOVERY_ENABLED && suggestionsOn && !paused,
    activeGuide,
    committedIds,
  });

  // Promote a suggestion to the place you're heading for next.
  const takeNext = useCallback(
    (id: string) => {
      const t = commitCandidate(id);
      if (t) {
        onAddPlace(t);
        onSetActive(t.id);
      }
      setSuggestionsOpen(false);
    },
    [commitCandidate, onAddPlace, onSetActive],
  );

  const unvisited = useMemo(
    () => yonder.targets.filter((t) => !t.visited),
    [yonder.targets],
  );
  const allVisited =
    yonder.targets.length > 0 && unvisited.length === 0;

  // The focus is the active target (set by tap / "go next" / mode). In
  // Collection with nothing chosen yet, focus the nearest unvisited place so it
  // gets the bold marker + name + distance; the rest stay ghosts.
  const focusIndex = useMemo(() => {
    if (yonder.activeIndex != null) return yonder.activeIndex;
    if (!position) return null;
    let best = -1;
    let bestD = Infinity;
    yonder.targets.forEach((t, i) => {
      if (t.visited) return;
      const d = haversine(position.lat, position.lon, t.lat, t.lon);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best >= 0 ? best : null;
  }, [yonder.activeIndex, yonder.targets, position]);

  const activeTarget = focusIndex != null ? yonder.targets[focusIndex] : null;

  // Favourite the active destination (the only walk-screen way to create a
  // favourite). Tracks the stored record's id so it can be un-favourited.
  const [favId, setFavId] = useState<string | null>(null);
  useEffect(() => {
    if (!activeTarget) {
      setFavId(null);
      return;
    }
    let cancelled = false;
    void getFavourite(
      activeTarget.lat,
      activeTarget.lon,
      activeTarget.name,
    ).then((f) => {
      if (!cancelled) setFavId(f?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [activeTarget]);

  const toggleFavourite = useCallback(async () => {
    if (!activeTarget) return;
    if (favId) {
      const id = favId;
      setFavId(null);
      await removeFavourite(id);
    } else {
      const fav = await pushFavourite({
        name: activeTarget.name,
        label: activeTarget.label,
        lat: activeTarget.lat,
        lon: activeTarget.lon,
      });
      setFavId(fav.id);
    }
  }, [activeTarget, favId]);

  // Arrival detection: any unvisited target within 25 m → queue an arrival chip.
  useEffect(() => {
    if (!position) return;
    let scheduled = false;
    setArrivalQueue((prev) => {
      const next = [...prev];
      for (const t of unvisited) {
        const dist = haversine(position.lat, position.lon, t.lat, t.lon);
        const inRadius = dist < ARRIVAL_RADIUS_M;
        const dismissed = dismissedArrivals[t.id];
        const already = next.includes(t.id);
        if (inRadius && !dismissed && !already) {
          next.push(t.id);
          scheduled = true;
        }
      }
      return scheduled ? next : prev;
    });
    // Clear dismissals once user leaves the radius.
    setDismissedArrivals((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const id of Object.keys(prev)) {
        const t = unvisited.find((x) => x.id === id);
        if (!t) {
          delete next[id];
          changed = true;
          continue;
        }
        const dist = haversine(position.lat, position.lon, t.lat, t.lon);
        if (dist > ARRIVAL_RADIUS_M * ARRIVAL_REARM_RATIO) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [position, unvisited, dismissedArrivals]);

  // Pinch-zoom only. The scope stays locked dead-centre, no panning.
  const gestureRef = useRef<{ startMpp: number; startDist?: number }>({
    startMpp: DEFAULT_MPP,
  });

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length < 2) return;
      gestureRef.current.startMpp = mpp;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      gestureRef.current.startDist = Math.hypot(
        t1.clientX - t2.clientX,
        t1.clientY - t2.clientY,
      );
    },
    [mpp],
  );

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const g = gestureRef.current;
    if (e.touches.length < 2 || !g.startDist) return;
    const t1 = e.touches[0];
    const t2 = e.touches[1];
    const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    if (dist > 0) {
      const scale = g.startDist / dist;
      setMpp(Math.min(MAX_MPP, Math.max(MIN_MPP, g.startMpp * scale)));
    }
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length !== 0) return;
      gestureRef.current.startDist = undefined;
      // Snap mpp to a level whose centre-to-rim distance is a round metres value.
      const rimR = Math.min(window.innerWidth, window.innerHeight) * RIM_FRACTION;
      const impliedMetres = rimR * mpp;
      let best = SCALE_LEVELS_M[0];
      let bestRatio = Math.abs(Math.log(best / impliedMetres));
      for (const lvl of SCALE_LEVELS_M) {
        const r = Math.abs(Math.log(lvl / impliedMetres));
        if (r < bestRatio) {
          best = lvl;
          bestRatio = r;
        }
      }
      setMpp(best / rimR);
    },
    [mpp],
  );

  const resetZoom = useCallback(() => {
    setMpp(DEFAULT_MPP);
  }, []);

  const zoomed = Math.abs(mpp - DEFAULT_MPP) > 0.01;

  const headerLabel = useMemo(() => {
    if (yonder.targets.length === 0) {
      return { kicker: "No destination", title: "Wandering free" };
    }
    if (yonder.mode === "ordered" && activeTarget) {
      const total = yonder.targets.length;
      const idx = yonder.activeIndex ?? 0;
      return {
        kicker: `Waypoint ${idx + 1} of ${total}`,
        title: activeTarget.name,
      };
    }
    if (yonder.mode === "collection") {
      const remaining = unvisited.length;
      return {
        kicker: `Collection · ${remaining} left`,
        title:
          activeTarget?.name ??
          yonder.name ??
          `${remaining} place${remaining === 1 ? "" : "s"} to find`,
      };
    }
    return {
      kicker: null,
      title: activeTarget?.name ?? yonder.name ?? "Yonder",
    };
  }, [yonder, activeTarget, unvisited]);

  const needsCalibration = position != null && heading == null;
  const currentArrivalId = arrivalQueue[0];
  const currentArrivalTarget = currentArrivalId
    ? unvisited.find((t) => t.id === currentArrivalId) ?? null
    : null;

  const dismissArrival = (visited: boolean) => {
    if (!currentArrivalTarget) return;
    const id = currentArrivalTarget.id;
    if (visited) {
      onSetVisited(id, true);
    } else {
      setDismissedArrivals((p) => ({ ...p, [id]: true }));
    }
    setArrivalQueue((p) => p.filter((x) => x !== id));
  };

  return (
    <div className="fixed inset-0 flex flex-col">
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="absolute inset-0"
      >
        <Scope
          position={position}
          heading={heading}
          track={track}
          targets={yonder.targets}
          activeIndex={focusIndex}
          mpp={mpp}
          hideNumbers={hideNumbers}
          onPickTarget={onSetActive}
          candidates={DISCOVERY_ENABLED && suggestionsOn ? candidates : undefined}
          onPickCandidate={
            DISCOVERY_ENABLED && suggestionsOn ? () => setSuggestionsOpen(true) : undefined
          }
        />
      </div>

      <WalkHeader
        kicker={headerLabel.kicker}
        title={headerLabel.title}
        titleAccessory={
          activeTarget ? (
            <button
              type="button"
              onClick={() => void toggleFavourite()}
              aria-label={favId ? "Remove from places" : "Save this place"}
              aria-pressed={favId != null}
              className={`shrink-0 size-7 flex items-center justify-center ${
                favId ? "text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              <Heart
                className="w-5 h-5"
                strokeWidth={1.75}
                fill={favId ? "var(--accent)" : "none"}
              />
            </button>
          ) : undefined
        }
        right={
          <>
            {DISCOVERY_ENABLED &&
              (suggestionsOn ? (
                <button
                  type="button"
                  onClick={() => setSuggestionsOpen(true)}
                  aria-label="Suggestions around you"
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-[var(--border)] text-[var(--muted)] hover:text-[var(--accent)] bg-black/30 backdrop-blur-sm"
                >
                  <Sparkles className="w-4 h-4" strokeWidth={1.75} />
                  <span className="text-sm tabular-nums">{candidates.length}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSuggestionsOn(true)}
                  aria-label="Turn suggestions on"
                  className="inline-flex items-center justify-center size-9 rounded-full border border-[var(--border)] text-[var(--muted)]/50 hover:text-[var(--accent)] bg-black/30 backdrop-blur-sm"
                >
                  <Sparkles className="w-4 h-4" strokeWidth={1.75} />
                </button>
              ))}
            <button
              type="button"
              onClick={() => setPanelOpen(true)}
              aria-label="Destinations"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-[var(--border)] text-[var(--muted)] hover:text-[var(--accent)] bg-black/30 backdrop-blur-sm"
            >
              <ListChecks className="w-4 h-4" strokeWidth={1.75} />
              <span className="text-sm tabular-nums">{yonder.targets.length}</span>
            </button>
          </>
        }
      />

      <div className="relative z-10 flex-1 flex flex-col justify-end px-5 pb-8 gap-4 pointer-events-none">
        {!position && (
          <p className="text-center text-xs text-[var(--muted)]">
            Searching for signal…
          </p>
        )}

        {needsCalibration && <CalibrateHint onCalibrate={onCalibrate} />}

        {zoomed && (
          <button
            type="button"
            onClick={resetZoom}
            className="self-center rounded-full bg-black/40 backdrop-blur-md border border-[var(--border)] text-xs text-[var(--muted)] hover:text-[var(--foreground)] px-3 py-1.5 pointer-events-auto flex items-center gap-1.5"
          >
            <Locate className="w-3 h-3" strokeWidth={1.75} />
            Reset zoom
          </button>
        )}

        {allVisited && !addSheetOpen && (
          <p className="self-center text-center text-xs text-[var(--accent)]/90 max-w-xs">
            All places visited, keep wandering, or finish whenever.
          </p>
        )}

        {currentArrivalTarget && (
          <div className="self-center rounded-2xl bg-black/55 backdrop-blur-md border border-[var(--accent)]/40 px-4 py-3 flex flex-col items-center gap-2 pointer-events-auto">
            <p className="text-sm text-[var(--foreground)] text-center">
              You&apos;re at{" "}
              <span className="font-display text-[var(--accent)]">
                {currentArrivalTarget.name}
              </span>
              ?
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => dismissArrival(false)}
                className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] px-2 py-1"
              >
                Not yet
              </button>
              <button
                type="button"
                onClick={() => dismissArrival(true)}
                className="rounded-full bg-[var(--accent)] text-black font-semibold px-4 py-1.5 active:opacity-80"
              >
                Visited ✓
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 pointer-events-auto">
          {!hideNumbers && (
            <StatStrip
              track={track}
              startTime={startTime}
              pausedMs={pausedMs}
              paused={paused}
            />
          )}

          <WalkControls
            paused={paused}
            onPause={onPause}
            onResume={onResume}
            onFinish={onFinish}
            onDiscard={onDiscard}
            extra={
              activeTarget ? (
                <button
                  type="button"
                  onClick={() => setDirectionsOpen(true)}
                  className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] inline-flex items-center gap-1"
                >
                  Just take me there
                  <ExternalLink className="w-3 h-3" strokeWidth={1.75} />
                </button>
              ) : undefined
            }
          />
        </div>

        <div className="flex items-center justify-center gap-2 text-[10px] text-[var(--muted)] tabular-nums min-h-4 pointer-events-auto">
          {geoError && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-1.5 rounded-full bg-[var(--accent)]" />
              {geoError === "permission-denied"
                ? "Location permission denied"
                : geoError === "timeout"
                  ? "Slow signal"
                  : "Signal unavailable"}
            </span>
          )}
          {!geoError && !hideNumbers && position?.acc != null && (
            <span>±{Math.round(position.acc)} m</span>
          )}
        </div>

        {suggestionsOn && (
          // Discovery POIs come from OpenStreetMap (ODbL), attribution is
          // required wherever they're shown.
          <p className="text-center text-[9px] text-[var(--muted)]/60 pointer-events-auto">
            Nearby places · © OpenStreetMap contributors
          </p>
        )}
      </div>

      <AddPlaceSheet
        open={addSheetOpen}
        position={position}
        onAdd={(t) => {
          onAddPlace(t);
          setAddSheetOpen(false);
        }}
        onClose={() => setAddSheetOpen(false)}
      />

      <DestinationsSheet
        open={panelOpen}
        targets={yonder.targets}
        focusIndex={focusIndex}
        position={position}
        onGoNext={onSetActive}
        onRemove={onRemoveTarget}
        onClearAll={() => {
          onClearTargets();
          setPanelOpen(false);
        }}
        onSetVisited={onSetVisited}
        onAdd={() => {
          setPanelOpen(false);
          setAddSheetOpen(true);
        }}
        onClose={() => setPanelOpen(false)}
      />

      {DISCOVERY_ENABLED && (
        <SuggestionsSheet
          open={suggestionsOpen}
          onClose={() => setSuggestionsOpen(false)}
          suggestions={candidates}
          activeGuide={activeGuide}
          onSetGuide={setActiveGuide}
          onTakeNext={takeNext}
          onSaveForLater={(c) => {
            void pushFavourite({
              name: c.name ?? "Nearby place",
              lat: c.lat,
              lon: c.lon,
            });
            skipCandidate(c.id);
          }}
          onDecline={skipCandidate}
          onTurnOff={() => {
            setSuggestionsOn(false);
            setSuggestionsOpen(false);
          }}
          hideNumbers={hideNumbers}
        />
      )}

      <BottomSheet
        open={directionsOpen}
        onClose={() => setDirectionsOpen(false)}
        title="Open in maps"
      >
        <p className="text-xs text-[var(--muted)] -mt-1">
          Hand off to a maps app for walking directions, then come back and
          keep wandering.
        </p>
        <ul className="flex flex-col divide-y divide-[var(--border)]">
          {activeTarget &&
            directionsOptions(activeTarget).map((o) => (
              <li key={o.id}>
                <a
                  href={o.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setDirectionsOpen(false)}
                  className="flex items-center justify-between py-3 hover:text-[var(--accent)]"
                >
                  <span className="font-display text-lg">{o.label}</span>
                  <ExternalLink className="w-4 h-4 text-[var(--muted)]" strokeWidth={1.75} />
                </a>
              </li>
            ))}
        </ul>
      </BottomSheet>

    </div>
  );
}

function DestinationsSheet({
  open,
  targets,
  focusIndex,
  position,
  onGoNext,
  onRemove,
  onClearAll,
  onSetVisited,
  onAdd,
  onClose,
}: {
  open: boolean;
  targets: Target[];
  focusIndex: number | null;
  position: Fix | null;
  onGoNext: (id: string) => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
  onSetVisited: (id: string, visited: boolean) => void;
  onAdd: () => void;
  onClose: () => void;
}) {
  const [seenOpen, setSeenOpen] = useState(false);
  const focusId = focusIndex != null ? targets[focusIndex]?.id : null;
  const unvisited = targets.filter((t) => !t.visited);
  const seen = targets.filter((t) => t.visited);
  const dist = (t: Target) =>
    position ? fmtDist(haversine(position.lat, position.lon, t.lat, t.lon)) : "";

  return (
    <BottomSheet open={open} onClose={onClose} title="Destinations">
        <ul className="flex flex-col">
          {unvisited.map((t) => {
            const isFocus = t.id === focusId;
            return (
              <li key={t.id} className="flex items-center gap-2 py-2.5 border-b border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => onSetVisited(t.id, true)}
                  aria-label="Mark visited"
                  className="size-5 rounded-full border border-[var(--muted)] hover:border-[var(--accent)] shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className={`font-display text-base truncate ${isFocus ? "text-[var(--accent)]" : ""}`}>{t.name}</div>
                  {dist(t) && <div className="text-[11px] font-mono text-[var(--muted)] tabular-nums">{dist(t)}</div>}
                </div>
                {isFocus ? (
                  <span className="text-[10px] uppercase tracking-widest text-[var(--accent)] shrink-0">Next</span>
                ) : (
                  <button type="button" onClick={() => onGoNext(t.id)} className="text-xs text-[var(--muted)] hover:text-[var(--accent)] shrink-0 px-1">
                    Go next
                  </button>
                )}
                <button type="button" onClick={() => onRemove(t.id)} aria-label="Remove" className="size-7 flex items-center justify-center text-[var(--muted)] hover:text-red-400 shrink-0">
                  <X className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </li>
            );
          })}
          {targets.length === 0 ? (
            <li className="text-sm text-[var(--muted)] py-2.5">
              Wandering free, no destination. Add a place any time, or just keep going.
            </li>
          ) : (
            unvisited.length === 0 && (
              <li className="text-sm text-[var(--muted)] py-2.5">All seen. Add another, or finish.</li>
            )
          )}
        </ul>

        {seen.length > 0 && (
          <section className="flex flex-col">
            <button type="button" onClick={() => setSeenOpen((v) => !v)} className="flex items-center justify-between py-2 text-[10px] uppercase tracking-widest text-[var(--muted)] hover:text-[var(--foreground)]">
              <span>Seen ({seen.length})</span>
              <span>{seenOpen ? "−" : "+"}</span>
            </button>
            {seenOpen &&
              seen.map((t) => (
                <div key={t.id} className="flex items-center gap-2 py-2 border-b border-[var(--border)] opacity-80">
                  <button
                    type="button"
                    onClick={() => onSetVisited(t.id, false)}
                    aria-label="Mark not visited"
                    title="Visit again"
                    className="size-5 rounded-full bg-[var(--accent)] text-black flex items-center justify-center text-[10px] shrink-0"
                  >
                    ✓
                  </button>
                  <div className="font-display text-base truncate flex-1 min-w-0">{t.name}</div>
                </div>
              ))}
          </section>
        )}

        <div className="mt-1 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 text-sm text-[var(--accent)] hover:opacity-80"
          >
            <Plus className="w-4 h-4" strokeWidth={1.75} />
            Add a place
          </button>
          {targets.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              Clear all → just wander
            </button>
          )}
        </div>
    </BottomSheet>
  );
}

function AddPlaceSheet({
  open,
  position,
  onAdd,
  onClose,
}: {
  open: boolean;
  position: Fix | null;
  onAdd: (t: Target) => void;
  onClose: () => void;
}) {
  // Shared debounced search, reads the live position via a ref, so a moving
  // GPS fix doesn't re-fire the geocode on every tick (the old local copy here
  // depended on `position` and over-queried during a walk).
  const { q, setQ, results, loading } = usePlaceSearch(position);

  return (
    <BottomSheet open={open} onClose={onClose} title="Add a place" minHeightVh={60}>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a place…"
          className="w-full bg-transparent border-b border-[var(--border)] px-1 py-2 text-base outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]/60"
          inputMode="search"
          enterKeyHint="search"
        />
        <ul className="flex flex-col divide-y divide-[var(--border)] overflow-y-auto min-h-12">
          {loading && (
            <li className="text-sm text-[var(--muted)] py-2">Searching…</li>
          )}
          {results.map((r, i) => (
            <li key={`${r.lat},${r.lon},${i}`}>
              <button
                type="button"
                onClick={() =>
                  onAdd({
                    id: crypto.randomUUID(),
                    name: r.name,
                    label: r.label,
                    lat: r.lat,
                    lon: r.lon,
                    visited: false,
                  })
                }
                className="w-full text-left py-2 hover:text-[var(--accent)]"
              >
                {r.dist != null && (
                  <div className="text-[11px] font-mono text-[var(--accent)] tabular-nums">
                    {fmtDist(r.dist)} away
                  </div>
                )}
                <div className="font-display text-base truncate">{r.name}</div>
                <div className="text-xs text-[var(--muted)] truncate">
                  {r.label}
                </div>
              </button>
            </li>
          ))}
        </ul>
    </BottomSheet>
  );
}

