"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { fmtDist } from "@/lib/geo";
import { rankResults } from "@/lib/rank";
import type {
  Fix,
  GeocodeResult,
  RankedResult,
  Target,
} from "@/lib/types";

type Props = {
  position: Fix | null;
  onPickSingle: (target: Target) => void;
  onComposeMulti: (seed: Target | null) => void;
};

export default function SearchScreen({
  position,
  onPickSingle,
  onComposeMulti,
}: Props) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<RankedResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 3) {
      setResults([]);
      setError(null);
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
          setError("Search failed");
          setResults([]);
          return;
        }
        const data = (await res.json()) as GeocodeResult[];
        setResults(rankResults(data, position));
        setError(null);
      } catch {
        if (myReq !== reqId.current) return;
        setError("Search failed");
        setResults([]);
      } finally {
        if (myReq === reqId.current) setLoading(false);
      }
    }, 550);
    return () => clearTimeout(handle);
  }, [q, position]);

  const empty = q.trim().length < 3;

  return (
    <div className="flex-1 flex flex-col w-full max-w-md mx-auto px-5 pt-12 pb-10 gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-4xl tracking-tight leading-none">
          Where to?
        </h1>
        <p className="text-sm text-[var(--warm)]">
          Pick a place. Walk toward the arrow.
        </p>
      </header>

      <label className="flex flex-col gap-2">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a place…"
          className="w-full bg-transparent border-b border-[var(--border)] px-1 py-3 text-lg outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]/60 transition-colors"
          inputMode="search"
          enterKeyHint="search"
        />
      </label>

      {!empty && (
        <div className="flex flex-col gap-1 min-h-12">
          {loading && (
            <p className="text-sm text-[var(--muted)] px-1">Searching…</p>
          )}
          {error && !loading && (
            <p className="text-sm text-red-400 px-1">{error}</p>
          )}
          {!loading && !error && results.length === 0 && (
            <p className="text-sm text-[var(--muted)] px-1">
              No matches — try adding the town.
            </p>
          )}
          <ul className="flex flex-col divide-y divide-[var(--border)]">
            {results.map((r, i) => (
              <li key={`${r.lat},${r.lon},${i}`}>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onPickSingle({
                        id: crypto.randomUUID(),
                        name: r.name,
                        label: r.label,
                        lat: r.lat,
                        lon: r.lon,
                        visited: false,
                      })
                    }
                    className="flex-1 text-left py-3 hover:text-[var(--accent)]"
                  >
                    {r.dist != null && (
                      <div className="text-[11px] font-mono text-[var(--accent)] tabular-nums">
                        {fmtDist(r.dist)} away
                      </div>
                    )}
                    <div className="font-display text-lg truncate">{r.name}</div>
                    <div className="text-xs text-[var(--muted)] mt-0.5 line-clamp-1">
                      {r.label}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onComposeMulti({
                        id: crypto.randomUUID(),
                        name: r.name,
                        label: r.label,
                        lat: r.lat,
                        lon: r.lon,
                        visited: false,
                      })
                    }
                    title="Add to a multi-place yonder"
                    aria-label="Build a multi-place yonder starting here"
                    className="px-3 text-[var(--muted)] hover:text-[var(--accent)]"
                  >
                    +
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={() => onComposeMulti(null)}
        className="self-start text-sm text-[var(--accent)] hover:opacity-80"
      >
        Build a multi-place yonder →
      </button>

      <div className="mt-auto flex items-center justify-center pt-6">
        <Link
          href="/explain"
          className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          How it works
        </Link>
      </div>
    </div>
  );
}
