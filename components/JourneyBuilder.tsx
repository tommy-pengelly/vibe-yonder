"use client";
import { useEffect, useRef, useState } from "react";
import { fmtDist } from "@/lib/geo";
import { rankResults } from "@/lib/rank";
import type { Destination, Fix, GeocodeResult, RankedResult } from "@/lib/types";

type Props = {
  waypoints: Destination[];
  position: Fix | null;
  onAdd: (d: Destination) => void;
  onRemove: (idx: number) => void;
  onMove: (idx: number, dir: -1 | 1) => void;
  onClear: () => void;
  onStart: () => void;
  onBack: () => void;
};

export default function JourneyBuilder({
  waypoints,
  position,
  onAdd,
  onRemove,
  onMove,
  onClear,
  onStart,
  onBack,
}: Props) {
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
    <div className="flex-1 flex flex-col w-full max-w-md mx-auto px-5 pt-8 pb-10 gap-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
            Journey
          </span>
          <h1 className="text-xl font-semibold">Build a chain of stops</h1>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] mt-1"
        >
          Back
        </button>
      </header>

      <ol className="flex flex-col gap-2">
        {waypoints.length === 0 && (
          <li className="text-sm text-[var(--muted)]">
            No waypoints yet. Search below to add one.
          </li>
        )}
        {waypoints.map((w, i) => (
          <li
            key={`${w.lat},${w.lon},${i}`}
            className="flex items-center gap-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] px-3 py-2"
          >
            <div className="text-xs text-[var(--accent)] tabular-nums w-6 shrink-0">
              {i + 1}.
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{w.name}</div>
              {w.label && (
                <div className="truncate text-xs text-[var(--muted)]">
                  {w.label}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 text-[var(--muted)]">
              <button
                type="button"
                onClick={() => onMove(i, -1)}
                disabled={i === 0}
                className="px-2 py-1 disabled:opacity-30 hover:text-[var(--foreground)]"
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => onMove(i, 1)}
                disabled={i === waypoints.length - 1}
                className="px-2 py-1 disabled:opacity-30 hover:text-[var(--foreground)]"
                aria-label="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="px-2 py-1 hover:text-red-400"
                aria-label="Remove"
              >
                ×
              </button>
            </div>
          </li>
        ))}
      </ol>

      <label className="flex flex-col gap-2 mt-2">
        <span className="text-xs uppercase tracking-wider text-[var(--muted)]">
          Add a waypoint
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a place…"
          className="w-full rounded-xl bg-[var(--surface)] border border-[var(--border)] px-4 py-3 text-base outline-none focus:border-[var(--accent)] transition-colors"
          inputMode="search"
          enterKeyHint="search"
        />
      </label>

      <ul className="flex flex-col divide-y divide-[var(--border)] min-h-12">
        {loading && (
          <li className="text-sm text-[var(--muted)] py-2">Searching…</li>
        )}
        {results.map((r, i) => (
          <li key={`${r.lat},${r.lon},${i}`}>
            <button
              type="button"
              onClick={() => {
                onAdd({ name: r.name, label: r.label, lat: r.lat, lon: r.lon });
                setQ("");
                setResults([]);
              }}
              className="w-full text-left rounded-lg px-3 py-2 hover:bg-[var(--surface)] active:bg-[var(--surface-2)] transition-colors"
            >
              {r.dist != null && (
                <div className="text-[11px] text-[var(--accent)] tabular-nums">
                  {fmtDist(r.dist)} away
                </div>
              )}
              <div className="text-sm font-medium truncate">{r.name}</div>
              <div className="text-xs text-[var(--muted)] truncate">
                {r.label}
              </div>
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex items-center gap-3 pt-4">
        {waypoints.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-[var(--muted)] hover:text-red-400"
          >
            Clear
          </button>
        )}
        <button
          type="button"
          onClick={onStart}
          disabled={waypoints.length === 0}
          className="flex-1 rounded-xl bg-[var(--accent)] text-black font-semibold py-3 active:opacity-80 disabled:opacity-30"
        >
          Start journey
        </button>
      </div>
    </div>
  );
}
