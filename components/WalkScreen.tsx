"use client";
import {
  ExternalLink,
  Heart,
  ListChecks,
  Locate,
  Pause,
  Plus,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { rankResults } from "@/lib/rank";
import { haversine, fmtDist } from "@/lib/geo";
import { externalDirectionsUrl } from "@/lib/maps";
import type {
  ActiveYonder,
  Fix,
  GeocodeResult,
  RankedResult,
  Target,
} from "@/lib/types";
import Scope from "./Scope";
import StatStrip from "./StatStrip";

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
        />
      </div>

      <header className="relative z-10 flex items-start justify-between gap-3 px-5 pt-6 pointer-events-none">
        <div className="flex flex-col min-w-0 pointer-events-auto">
          {headerLabel.kicker && (
            <span className="text-[10px] uppercase tracking-widest text-[var(--accent)]/80">
              {headerLabel.kicker}
            </span>
          )}
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="font-display text-2xl tracking-tight leading-tight truncate">
              {headerLabel.title}
            </h1>
            {activeTarget && (
              <button
                type="button"
                onClick={() => void toggleFavourite()}
                aria-label={favId ? "Remove favourite" : "Favourite this place"}
                aria-pressed={favId != null}
                className={`shrink-0 size-7 flex items-center justify-center ${
                  favId
                    ? "text-[var(--accent)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                <Heart
                  className="w-5 h-5"
                  strokeWidth={1.75}
                  fill={favId ? "var(--accent)" : "none"}
                />
              </button>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          aria-label="Destinations"
          className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-[var(--border)] text-[var(--muted)] hover:text-[var(--accent)] pointer-events-auto bg-black/30 backdrop-blur-sm"
        >
          <ListChecks className="w-4 h-4" strokeWidth={1.75} />
          <span className="text-sm tabular-nums">{yonder.targets.length}</span>
        </button>
      </header>

      <div className="relative z-10 flex-1 flex flex-col justify-end px-5 pb-8 gap-4 pointer-events-none">
        {!position && (
          <p className="text-center text-xs text-[var(--muted)]">
            Searching for signal…
          </p>
        )}

        {needsCalibration && (
          <div className="self-center text-center text-xs text-[var(--muted)] max-w-xs pointer-events-auto">
            Point your phone to set direction.
            <button
              type="button"
              onClick={onCalibrate}
              className="block mx-auto mt-1 text-[var(--accent)] hover:opacity-80"
            >
              Tap if it still doesn&apos;t move
            </button>
          </div>
        )}

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

          <div className="flex items-center justify-between gap-3 pt-1">
            {paused ? (
              <>
                <button
                  type="button"
                  onClick={onDiscard}
                  className="text-xs text-[var(--muted)] hover:text-red-400 px-2 py-1"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={onResume}
                  className="rounded-full bg-[var(--accent)] text-black font-semibold px-6 py-2.5 active:opacity-80"
                >
                  Resume
                </button>
                <button
                  type="button"
                  onClick={onFinish}
                  className="text-xs text-[var(--foreground)] hover:text-[var(--accent)] px-2 py-1"
                >
                  Finish
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onPause}
                  aria-label="Pause"
                  className="size-11 rounded-full border border-[var(--border)] flex items-center justify-center text-[var(--foreground)] hover:border-[var(--accent)] bg-black/30 backdrop-blur-sm"
                >
                  <Pause className="w-4 h-4" strokeWidth={1.75} />
                </button>
                {activeTarget && (
                  <a
                    href={externalDirectionsUrl(activeTarget)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] inline-flex items-center gap-1"
                  >
                    Just take me there
                    <ExternalLink className="w-3 h-3" strokeWidth={1.75} />
                  </a>
                )}
                <button
                  type="button"
                  onClick={onFinish}
                  className="rounded-full border border-[var(--accent)]/60 text-[var(--accent)] font-semibold px-5 py-2 hover:bg-[var(--accent)] hover:text-black bg-black/30 backdrop-blur-sm"
                >
                  Finish
                </button>
              </>
            )}
          </div>
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
      </div>

      {addSheetOpen && (
        <AddPlaceSheet
          position={position}
          onAdd={(t) => {
            onAddPlace(t);
            setAddSheetOpen(false);
          }}
          onClose={() => setAddSheetOpen(false)}
        />
      )}

      {panelOpen && (
        <DestinationsSheet
          targets={yonder.targets}
          focusIndex={focusIndex}
          position={position}
          onGoNext={onSetActive}
          onRemove={onRemoveTarget}
          onSetVisited={onSetVisited}
          onAdd={() => setAddSheetOpen(true)}
          onClose={() => setPanelOpen(false)}
        />
      )}
    </div>
  );
}

function DestinationsSheet({
  targets,
  focusIndex,
  position,
  onGoNext,
  onRemove,
  onSetVisited,
  onAdd,
  onClose,
}: {
  targets: Target[];
  focusIndex: number | null;
  position: Fix | null;
  onGoNext: (id: string) => void;
  onRemove: (id: string) => void;
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
    <div className="fixed inset-0 z-30 flex items-end bg-black/50" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-h-[70vh] overflow-y-auto bg-[var(--surface)] border-t border-[var(--border)] rounded-t-2xl px-5 pt-5 pb-6 flex flex-col gap-3"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">Destinations</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="size-8 flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)]">
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

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
                {targets.length > 1 && (
                  <button type="button" onClick={() => onRemove(t.id)} aria-label="Remove" className="size-7 flex items-center justify-center text-[var(--muted)] hover:text-red-400 shrink-0">
                    <X className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                )}
              </li>
            );
          })}
          {unvisited.length === 0 && (
            <li className="text-sm text-[var(--muted)] py-2.5">All seen. Add another, or finish.</li>
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

        <button
          type="button"
          onClick={onAdd}
          className="mt-1 self-start inline-flex items-center gap-1.5 text-sm text-[var(--accent)] hover:opacity-80"
        >
          <Plus className="w-4 h-4" strokeWidth={1.75} />
          Add a place
        </button>
      </div>
    </div>
  );
}

function AddPlaceSheet({
  position,
  onAdd,
  onClose,
}: {
  position: Fix | null;
  onAdd: (t: Target) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<RankedResult[]>([]);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }
    const myReq = ++reqId.current;
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const near = position
          ? `&lat=${position.lat}&lon=${position.lon}`
          : "";
        const res = await fetch(
          `/api/geocode?q=${encodeURIComponent(term)}${near}`,
        );
        if (myReq !== reqId.current) return;
        if (!res.ok) {
          setResults([]);
          return;
        }
        const data = (await res.json()) as GeocodeResult[];
        setResults(rankResults(data, position));
      } catch {
        if (myReq === reqId.current) setResults([]);
      } finally {
        if (myReq === reqId.current) setLoading(false);
      }
    }, 550);
    return () => clearTimeout(handle);
  }, [q, position]);

  return (
    <div
      className="fixed inset-0 z-30 flex items-end bg-black/40"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-h-[60vh] bg-[var(--surface)] border-t border-[var(--border)] rounded-t-2xl px-5 pt-5 pb-6 flex flex-col gap-3"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">Add a place</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="size-8 flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
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
      </div>
    </div>
  );
}

