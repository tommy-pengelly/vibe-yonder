"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { fmtDist } from "@/lib/geo";
import { rankResults } from "@/lib/rank";
import type {
  Destination,
  FavouritePlace,
  Fix,
  GeocodeResult,
  RankedResult,
  SavedYonder,
  StoredList,
} from "@/lib/types";

type Props = {
  position: Fix | null;
  favourites: FavouritePlace[];
  lists: StoredList[];
  recent: SavedYonder[];
  onPick: (d: Destination) => void;
  onAddToDraftList: (d: Destination) => void;
  onOpenList: (l: StoredList) => void;
  onOpenListBuilder: () => void;
  onOpenRecap: (y: SavedYonder) => void;
  onBack: () => void;
};

export default function SearchScreen({
  position,
  favourites,
  lists,
  recent,
  onPick,
  onAddToDraftList,
  onOpenList,
  onOpenListBuilder,
  onOpenRecap,
  onBack,
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
    <div className="flex-1 flex flex-col w-full max-w-md mx-auto px-5 pt-8 pb-10 gap-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl tracking-tight leading-none">
            Where to?
          </h1>
          <p className="text-sm text-[var(--warm)] mt-2">
            Pick a place. Walk toward the arrow.
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] mt-1"
        >
          Back
        </button>
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
            <p className="text-sm text-[var(--muted)] px-1">No matches.</p>
          )}
          <ul className="flex flex-col divide-y divide-[var(--border)]">
            {results.map((r, i) => (
              <li key={`${r.lat},${r.lon},${i}`}>
                <div className="flex items-center gap-2">
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
                      onAddToDraftList({
                        name: r.name,
                        label: r.label,
                        lat: r.lat,
                        lon: r.lon,
                      })
                    }
                    title="Add to a list"
                    aria-label="Add to a list"
                    className="px-3 text-[var(--muted)] hover:text-[var(--foreground)]"
                  >
                    +
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {empty && (
        <div className="flex flex-col gap-6">
          {favourites.length > 0 && (
            <Section title="Favourites">
              <ul className="flex flex-col divide-y divide-[var(--border)]">
                {favourites.slice(0, 4).map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() =>
                        onPick({
                          name: f.name,
                          label: f.label,
                          lat: f.lat,
                          lon: f.lon,
                        })
                      }
                      className="w-full text-left py-3 hover:text-[var(--accent)]"
                    >
                      <div className="font-display text-lg truncate">
                        {f.name}
                      </div>
                      {f.label && (
                        <div className="text-xs text-[var(--muted)] truncate">
                          {f.label}
                        </div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section
            title="Your lists"
            action={
              <button
                type="button"
                onClick={onOpenListBuilder}
                className="text-xs text-[var(--accent)] hover:opacity-80"
              >
                New list →
              </button>
            }
          >
            {lists.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                Build a chain of places to wander between.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-[var(--border)]">
                {lists.map((l) => {
                  const remaining = l.items.filter((i) => !i.visited).length;
                  return (
                    <li key={l.id}>
                      <button
                        type="button"
                        onClick={() => onOpenList(l)}
                        className="w-full text-left py-3 flex items-center justify-between hover:text-[var(--accent)]"
                      >
                        <div className="min-w-0">
                          <div className="font-display text-lg truncate">
                            {l.name}
                          </div>
                          <div className="text-xs text-[var(--muted)]">
                            {l.items.length} place
                            {l.items.length === 1 ? "" : "s"}
                            {l.items.length > 0 && remaining < l.items.length
                              ? ` · ${remaining} left`
                              : ""}
                          </div>
                        </div>
                        <span className="text-[var(--muted)]">→</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          {recent.length > 0 && (
            <Section title="Recent yonders">
              <ul className="flex flex-col divide-y divide-[var(--border)]">
                {recent.slice(0, 4).map((y) => (
                  <li key={y.id}>
                    <button
                      type="button"
                      onClick={() => onOpenRecap(y)}
                      className="w-full text-left py-3 flex items-center justify-between gap-3 hover:text-[var(--accent)]"
                    >
                      <div className="min-w-0">
                        <div className="font-display text-lg truncate">
                          {y.name}
                        </div>
                        <div className="text-xs text-[var(--muted)] mt-0.5">
                          {new Date(y.endedAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}{" "}
                          · {(y.walked / 1000).toFixed(2)} km
                        </div>
                      </div>
                      <div className="text-xs font-mono text-[var(--accent)] tabular-nums shrink-0">
                        {y.yondered.toFixed(2)}×
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}

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

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
