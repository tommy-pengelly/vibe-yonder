"use client";
import {
  ExternalLink,
  Locate,
  Pause,
  Plus,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  onArrivalConfirm: (targetId: string, visited: boolean) => void;
  onAddPlace: (target: Target) => void;
  onCalibrate: () => void;
};

const ARRIVAL_RADIUS_M = 25;
const DEFAULT_MPP = 0.6;
const MIN_MPP = 0.12;
const MAX_MPP = 12;
const SCALE_LEVELS_M = [25, 50, 100, 250, 500, 1000, 2500, 5000];
const RIM_FRACTION = 0.42;

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
  onArrivalConfirm,
  onAddPlace,
  onCalibrate,
}: Props) {
  const [mpp, setMpp] = useState(DEFAULT_MPP);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [arrivalQueue, setArrivalQueue] = useState<string[]>([]);
  const [dismissedArrivals, setDismissedArrivals] = useState<
    Record<string, boolean>
  >({});
  const [addSheetOpen, setAddSheetOpen] = useState(false);

  const activeTarget =
    yonder.activeIndex != null ? yonder.targets[yonder.activeIndex] : null;

  const unvisited = useMemo(
    () => yonder.targets.filter((t) => !t.visited),
    [yonder.targets],
  );
  const allVisited =
    yonder.targets.length > 0 && unvisited.length === 0;

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
        if (dist > ARRIVAL_RADIUS_M * 1.6) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [position, unvisited, dismissedArrivals]);

  // Pinch + pan touch handling on the canvas wrap.
  const gestureRef = useRef<{
    startMpp: number;
    startPan: { x: number; y: number };
    startDist?: number;
    startCenter?: { x: number; y: number };
    lastTouch?: { x: number; y: number };
    mode: "idle" | "pan" | "pinch";
  }>({ startMpp: DEFAULT_MPP, startPan: { x: 0, y: 0 }, mode: "idle" });

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      gestureRef.current.startMpp = mpp;
      gestureRef.current.startPan = panOffset;
      if (e.touches.length >= 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dx = t1.clientX - t2.clientX;
        const dy = t1.clientY - t2.clientY;
        gestureRef.current.startDist = Math.hypot(dx, dy);
        gestureRef.current.startCenter = {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2,
        };
        gestureRef.current.mode = "pinch";
      } else if (e.touches.length === 1) {
        gestureRef.current.lastTouch = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
        gestureRef.current.mode = "pan";
      }
    },
    [mpp, panOffset],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const g = gestureRef.current;
      if (g.mode === "pinch" && e.touches.length >= 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dx = t1.clientX - t2.clientX;
        const dy = t1.clientY - t2.clientY;
        const dist = Math.hypot(dx, dy);
        if (g.startDist && g.startDist > 0) {
          const scale = g.startDist / dist;
          const next = Math.min(MAX_MPP, Math.max(MIN_MPP, g.startMpp * scale));
          setMpp(next);
        }
      } else if (g.mode === "pan" && e.touches.length === 1) {
        const t = e.touches[0];
        if (g.lastTouch) {
          const dx = t.clientX - g.lastTouch.x;
          const dy = t.clientY - g.lastTouch.y;
          setPanOffset((p) => ({ x: p.x + dx, y: p.y + dy }));
        }
        g.lastTouch = { x: t.clientX, y: t.clientY };
      }
    },
    [],
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const g = gestureRef.current;
      if (e.touches.length === 0) {
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
        g.mode = "idle";
      } else if (e.touches.length === 1) {
        g.mode = "pan";
        g.lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    },
    [mpp],
  );

  const recenter = useCallback(() => {
    setPanOffset({ x: 0, y: 0 });
    setMpp(DEFAULT_MPP);
  }, []);

  const panned =
    Math.abs(panOffset.x) > 2 ||
    Math.abs(panOffset.y) > 2 ||
    Math.abs(mpp - DEFAULT_MPP) > 0.01;

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
        kicker: "Collection",
        title:
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
      onArrivalConfirm(id, true);
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
          activeIndex={yonder.activeIndex}
          mpp={mpp}
          hideNumbers={hideNumbers}
          panOffset={panOffset}
        />
      </div>

      <header className="relative z-10 flex items-start justify-between gap-3 px-5 pt-6 pointer-events-none">
        <div className="flex flex-col min-w-0 pointer-events-auto">
          {headerLabel.kicker && (
            <span className="text-[10px] uppercase tracking-widest text-[var(--accent)]/80">
              {headerLabel.kicker}
            </span>
          )}
          <h1 className="font-display text-2xl tracking-tight leading-tight truncate">
            {headerLabel.title}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setAddSheetOpen(true)}
          aria-label="Add a place"
          className="size-9 rounded-full border border-[var(--border)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--accent)] pointer-events-auto bg-black/30 backdrop-blur-sm"
        >
          <Plus className="w-4 h-4" strokeWidth={1.75} />
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

        {panned && (
          <button
            type="button"
            onClick={recenter}
            className="self-center rounded-full bg-black/40 backdrop-blur-md border border-[var(--border)] text-xs text-[var(--muted)] hover:text-[var(--foreground)] px-3 py-1.5 pointer-events-auto flex items-center gap-1.5"
          >
            <Locate className="w-3 h-3" strokeWidth={1.75} />
            Recentre
          </button>
        )}

        {allVisited && !addSheetOpen && (
          <p className="self-center text-center text-xs text-[var(--accent)]/90 max-w-xs">
            All places visited — keep wandering, or finish whenever.
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
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(term)}`);
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

