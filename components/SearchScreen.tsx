"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { fmtDist } from "@/lib/geo";
import { rankResults } from "@/lib/rank";
import type { Destination, Fix, GeocodeResult, RankedResult } from "@/lib/types";

type Props = {
  position: Fix | null;
  onPick: (d: Destination) => void;
  onAddToJourney: (d: Destination) => void;
  onOpenJourneyBuilder: () => void;
  journeyCount: number;
};

export default function SearchScreen({
  position,
  onPick,
  onAddToJourney,
  onOpenJourneyBuilder,
  journeyCount,
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

  return (
    <div className="flex-1 flex flex-col w-full max-w-md mx-auto px-5 pt-10 pb-16 gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Vibe Yonder</h1>
        <p className="text-sm text-[var(--muted)]">
          Pick a place. Walk toward the arrow.
        </p>
      </header>

      <label className="flex flex-col gap-2 mt-2">
        <span className="text-xs uppercase tracking-wider text-[var(--muted)]">
          Where to?
        </span>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tate Modern, Mont Blanc, the corner pub…"
          className="w-full rounded-xl bg-[var(--surface)] border border-[var(--border)] px-4 py-3 text-base outline-none focus:border-[var(--accent)] transition-colors"
          inputMode="search"
          enterKeyHint="search"
        />
      </label>

      <div className="flex flex-col gap-1 mt-1 min-h-12">
        {loading && (
          <p className="text-sm text-[var(--muted)] px-1">Searching…</p>
        )}
        {error && !loading && (
          <p className="text-sm text-red-400 px-1">{error}</p>
        )}
        {!loading && !error && q.trim().length >= 3 && results.length === 0 && (
          <p className="text-sm text-[var(--muted)] px-1">No matches.</p>
        )}
        <ul className="flex flex-col divide-y divide-[var(--border)]">
          {results.map((r, i) => (
            <li key={`${r.lat},${r.lon},${i}`} className="py-1">
              <div className="flex items-stretch gap-1">
                <button
                  type="button"
                  onClick={() =>
                    onPick({
                      name: r.name,
                      label: r.label,
                      lat: r.lat,
                      lon: r.lon,
                    })
                  }
                  className="flex-1 text-left rounded-lg px-3 py-2 hover:bg-[var(--surface)] active:bg-[var(--surface-2)] transition-colors"
                >
                  {r.dist != null && (
                    <div className="text-[11px] text-[var(--accent)] tabular-nums">
                      {fmtDist(r.dist)} away
                    </div>
                  )}
                  <div className="font-medium truncate">{r.name}</div>
                  <div className="text-xs text-[var(--muted)] mt-0.5 line-clamp-2">
                    {r.label}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onAddToJourney({
                      name: r.name,
                      label: r.label,
                      lat: r.lat,
                      lon: r.lon,
                    })
                  }
                  title="Add to journey"
                  aria-label="Add to journey"
                  className="px-3 rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)]"
                >
                  +
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto flex items-center justify-between text-xs text-[var(--muted)] pt-6">
        <button
          type="button"
          onClick={onOpenJourneyBuilder}
          className="underline-offset-2 hover:underline"
        >
          {journeyCount > 0
            ? `Journey (${journeyCount}) →`
            : "Build a journey →"}
        </button>
        <Link href="/explain" className="underline-offset-2 hover:underline">
          How it works ?
        </Link>
      </div>
    </div>
  );
}
