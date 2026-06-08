"use client";
import { useEffect, useRef, useState } from "react";
import type { Destination, GeocodeResult } from "@/lib/types";

type Props = {
  onPick: (d: Destination) => void;
};

export default function SearchScreen({ onPick }: Props) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
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
        setResults(data);
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
  }, [q]);

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
          placeholder="Tate Modern, Mont Blanc, 1600 Pennsylvania Ave…"
          className="w-full rounded-xl bg-[#141414] border border-[var(--border)] px-4 py-3 text-base outline-none focus:border-[var(--accent)] transition-colors"
          inputMode="search"
          enterKeyHint="search"
        />
      </label>

      <div className="flex flex-col gap-1 mt-2 min-h-12">
        {loading && (
          <p className="text-sm text-[var(--muted)] px-1">Searching…</p>
        )}
        {error && !loading && (
          <p className="text-sm text-red-400 px-1">{error}</p>
        )}
        {!loading && !error && q.trim().length >= 3 && results.length === 0 && (
          <p className="text-sm text-[var(--muted)] px-1">No matches.</p>
        )}
        <ul className="flex flex-col">
          {results.map((r, i) => (
            <li key={`${r.lat},${r.lon},${i}`}>
              <button
                type="button"
                onClick={() =>
                  onPick({ name: r.name, label: r.label, lat: r.lat, lon: r.lon })
                }
                className="w-full text-left rounded-lg px-3 py-3 hover:bg-[#141414] active:bg-[#1c1c1c] transition-colors"
              >
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-[var(--muted)] mt-0.5 line-clamp-2">
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
