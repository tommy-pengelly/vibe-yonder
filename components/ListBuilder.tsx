"use client";
import { useEffect, useRef, useState } from "react";
import { fmtDist } from "@/lib/geo";
import { rankResults } from "@/lib/rank";
import type {
  Fix,
  GeocodeResult,
  ListItemState,
  RankedResult,
} from "@/lib/types";

type Props = {
  items: ListItemState[];
  initialName?: string;
  position: Fix | null;
  onAdd: (item: Omit<ListItemState, "id" | "visited">) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onSave: (name: string) => void;
  onCancel: () => void;
};

export default function ListBuilder({
  items,
  initialName,
  position,
  onAdd,
  onRemove,
  onMove,
  onSave,
  onCancel,
}: Props) {
  const [name, setName] = useState(initialName ?? "");
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

  const trimmedName = name.trim();
  const placeholderName = items[0]?.name ?? "Untitled";

  return (
    <div className="flex-1 flex flex-col w-full max-w-md mx-auto px-5 pt-8 pb-10 gap-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
            New list
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={placeholderName}
            className="font-display text-3xl tracking-tight bg-transparent outline-none w-full mt-1 placeholder:text-[var(--muted)]/40"
          />
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
        {items.length === 0 && (
          <li className="text-sm text-[var(--muted)] py-2">
            No places yet. Search below to add one.
          </li>
        )}
        {items.map((it, i) => (
          <li
            key={it.id}
            className="flex items-center gap-2 py-2 border-b border-[var(--border)]"
          >
            <div className="font-mono text-xs text-[var(--accent)] tabular-nums w-5 shrink-0">
              {i + 1}.
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-display text-base truncate">{it.name}</div>
              {it.label && (
                <div className="text-xs text-[var(--muted)] truncate">
                  {it.label}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 text-[var(--muted)]">
              <button
                type="button"
                onClick={() => onMove(it.id, -1)}
                disabled={i === 0}
                className="px-2 py-1 disabled:opacity-30 hover:text-[var(--foreground)]"
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => onMove(it.id, 1)}
                disabled={i === items.length - 1}
                className="px-2 py-1 disabled:opacity-30 hover:text-[var(--foreground)]"
                aria-label="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => onRemove(it.id)}
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
              onClick={() => {
                onAdd({
                  name: r.name,
                  label: r.label,
                  lat: r.lat,
                  lon: r.lon,
                });
                setQ("");
                setResults([]);
              }}
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
        onClick={() =>
          onSave(trimmedName.length > 0 ? trimmedName : placeholderName)
        }
        disabled={items.length === 0}
        className="mt-auto rounded-full bg-[var(--accent)] text-black font-semibold py-3 active:opacity-80 disabled:opacity-30"
      >
        Save list
      </button>
    </div>
  );
}
