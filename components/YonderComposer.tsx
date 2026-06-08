"use client";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { fmtDist } from "@/lib/geo";
import { rankResults } from "@/lib/rank";
import type {
  Fix,
  GeocodeResult,
  RankedResult,
  Target,
  YonderMode,
} from "@/lib/types";

type Props = {
  initial: Target[];
  position: Fix | null;
  onStart: (targets: Target[], mode: YonderMode) => void;
  onCancel: () => void;
};

export default function YonderComposer({
  initial,
  position,
  onStart,
  onCancel,
}: Props) {
  const [targets, setTargets] = useState<Target[]>(initial);
  const [mode, setMode] = useState<YonderMode>(
    initial.length >= 2 ? "collection" : "single",
  );
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

  const add = (r: { name: string; label: string; lat: number; lon: number }) => {
    setTargets((ts) => {
      const next: Target[] = [
        ...ts,
        {
          id: crypto.randomUUID(),
          name: r.name,
          label: r.label,
          lat: r.lat,
          lon: r.lon,
          visited: false,
        },
      ];
      if (next.length === 1) setMode("single");
      else if (mode === "single") setMode("collection");
      return next;
    });
    setQ("");
    setResults([]);
  };

  const remove = (id: string) => {
    setTargets((ts) => {
      const next = ts.filter((t) => t.id !== id);
      if (next.length < 2 && mode !== "single") setMode("single");
      return next;
    });
  };

  const move = (id: string, dir: -1 | 1) => {
    setTargets((ts) => {
      const idx = ts.findIndex((t) => t.id === id);
      if (idx < 0) return ts;
      const target = idx + dir;
      if (target < 0 || target >= ts.length) return ts;
      const next = [...ts];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const showOrderControls = mode === "ordered";
  const effectiveMode: YonderMode =
    targets.length <= 1 ? "single" : mode;

  return (
    <div className="flex-1 flex flex-col w-full max-w-md mx-auto px-5 pt-8 pb-10 gap-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
            New yonder
          </span>
          <h1 className="font-display text-3xl tracking-tight leading-none mt-1">
            Pick your places
          </h1>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] mt-1"
        >
          Back
        </button>
      </header>

      <ol className="flex flex-col">
        {targets.length === 0 && (
          <li className="text-sm text-[var(--muted)] py-2">
            Add a place below. One picks a destination; two or more lets you
            wander between them.
          </li>
        )}
        {targets.map((t, i) => (
          <li
            key={t.id}
            className="flex items-center gap-2 py-2 border-b border-[var(--border)]"
          >
            <div className="font-mono text-xs text-[var(--accent)] tabular-nums w-5 shrink-0">
              {showOrderControls ? `${i + 1}.` : "·"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-display text-base truncate">{t.name}</div>
              {t.label && (
                <div className="text-xs text-[var(--muted)] truncate">
                  {t.label}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 text-[var(--muted)]">
              {showOrderControls && (
                <>
                  <button
                    type="button"
                    onClick={() => move(t.id, -1)}
                    disabled={i === 0}
                    className="size-8 flex items-center justify-center disabled:opacity-30 hover:text-[var(--foreground)]"
                    aria-label="Move up"
                  >
                    <ArrowUp className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(t.id, 1)}
                    disabled={i === targets.length - 1}
                    className="size-8 flex items-center justify-center disabled:opacity-30 hover:text-[var(--foreground)]"
                    aria-label="Move down"
                  >
                    <ArrowDown className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => remove(t.id)}
                className="size-8 flex items-center justify-center hover:text-red-400"
                aria-label="Remove"
              >
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
          </li>
        ))}
      </ol>

      {targets.length >= 2 && (
        <div
          role="radiogroup"
          aria-label="Yonder type"
          className="flex items-center gap-2 text-sm"
        >
          <ModeChip
            label="Wander between"
            sub="Collection — no order"
            active={mode === "collection"}
            onClick={() => setMode("collection")}
          />
          <ModeChip
            label="Step through"
            sub="Ordered — one by one"
            active={mode === "ordered"}
            onClick={() => setMode("ordered")}
          />
        </div>
      )}

      <label className="flex flex-col gap-2 mt-1">
        <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
          Add a place
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a place…"
          className="w-full bg-transparent border-b border-[var(--border)] px-1 py-2 text-base outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]/60"
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
              onClick={() =>
                add({
                  name: r.name,
                  label: r.label,
                  lat: r.lat,
                  lon: r.lon,
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

      <button
        type="button"
        onClick={() => onStart(targets, effectiveMode)}
        disabled={targets.length === 0}
        className="mt-auto rounded-full bg-[var(--accent)] text-black font-semibold py-3 active:opacity-80 disabled:opacity-30"
      >
        {targets.length === 0
          ? "Add a place to start"
          : targets.length === 1
            ? "Start"
            : effectiveMode === "ordered"
              ? `Start · step through ${targets.length}`
              : `Start · wander ${targets.length}`}
      </button>
    </div>
  );
}

function ModeChip({
  label,
  sub,
  active,
  onClick,
}: {
  label: string;
  sub: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`flex-1 rounded-2xl border px-3 py-2 text-left transition-colors ${
        active
          ? "border-[var(--accent)] bg-[var(--surface)]"
          : "border-[var(--border)] hover:border-[var(--muted)]"
      }`}
    >
      <div
        className={`text-sm font-medium ${
          active ? "text-[var(--accent)]" : "text-[var(--foreground)]"
        }`}
      >
        {label}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-[var(--muted)] mt-0.5">
        {sub}
      </div>
    </button>
  );
}
