"use client";
import { Compass, Map as MapIcon, MapPin, Navigation, Plus, Ruler, Search, Star, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { usePlaceSearch } from "@/hooks/usePlaceSearch";
import PlaceDetailSheet, { type PlaceLite } from "@/components/PlaceDetailSheet";
import StarField from "@/components/StarField";
import { loadFavourites } from "@/lib/data";
import { fmtDist } from "@/lib/geo";
import type {
  FavouritePlace,
  Fix,
  RankedResult,
  PlayMode,
  Target,
  YonderMode,
} from "@/lib/types";

type StartOpts = {
  mapId?: string;
  mapItemIdByTargetId?: Record<string, string>;
  name?: string;
  play?: PlayMode;
  missionId?: string;
  origin?: { lat: number; lon: number };
};

function toTarget(r: { name: string; label?: string; lat: number; lon: number }): Target {
  return { id: crypto.randomUUID(), name: r.name, label: r.label, lat: r.lat, lon: r.lon, visited: false };
}

export default function CreateHub({
  position,
  onStart,
  onClose,
}: {
  position: Fix | null;
  onStart: (targets: Target[], mode: YonderMode, opts?: StartOpts) => void;
  /** Omitted on the landing (it's home, nothing to close to). */
  onClose?: () => void;
}) {
  const router = useRouter();
  const [favourites, setFavourites] = useState<FavouritePlace[]>([]);
  const { q, setQ, results, loading } = usePlaceSearch(position, favourites);
  const [picks, setPicks] = useState<Target[]>([]);
  const [mode, setMode] = useState<YonderMode>("collection");
  const [detail, setDetail] = useState<(PlaceLite & RankedResult) | null>(null);
  const [lineMode, setLineMode] = useState(false);
  // Open straight in line mode when launched via "New mission" (a sessionStorage
  // hint set just before navigating here). Read it in an effect, not a useState
  // initializer, so React 18 StrictMode's double-invoke can't clear the flag.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem("vibe-yonder.createMode") === "line") {
      window.sessionStorage.removeItem("vibe-yonder.createMode");
      setLineMode(true);
    }
  }, []);
  // The straight line's start (A); once set, the next pick is the end (B).
  const [lineStart, setLineStart] = useState<{ name: string; lat: number; lon: number } | null>(null);

  const building = picks.length > 0;
  const typing = q.trim().length > 0;

  const exitLine = () => {
    setLineMode(false);
    setLineStart(null);
    setQ("");
  };

  const beginLine = (
    a: { name: string; lat: number; lon: number },
    b: { name: string; label?: string; lat: number; lon: number },
  ) => {
    exitLine();
    onStart([toTarget(b)], "single", {
      play: "straightline",
      origin: { lat: a.lat, lon: a.lon },
      name: `${a.name} → ${b.name}`,
    });
  };

  // Most straight lines start where you are. Auto-fill the start with your
  // location on entering line mode (once GPS is in), so you skip straight to
  // picking the far point. "change" clears it to set a custom start.
  const lineAutoStarted = useRef(false);
  useEffect(() => {
    if (!lineMode) {
      lineAutoStarted.current = false;
      return;
    }
    if (!lineAutoStarted.current && !lineStart && position) {
      lineAutoStarted.current = true;
      setLineStart({ name: "your location", lat: position.lat, lon: position.lon });
    }
  }, [lineMode, lineStart, position]);

  useEffect(() => {
    let c = false;
    void loadFavourites().then((f) => !c && setFavourites(f));
    return () => {
      c = true;
    };
  }, []);

  const addPick = (r: RankedResult) => {
    setPicks((p) => [...p, toTarget(r)]);
    setQ("");
  };
  const removePick = (id: string) => setPicks((p) => p.filter((t) => t.id !== id));

  const onResultTap = (r: RankedResult) => {
    if (lineMode) {
      if (!lineStart) {
        setLineStart({ name: r.name, lat: r.lat, lon: r.lon });
        setQ("");
      } else {
        beginLine(lineStart, r);
      }
    } else if (building) addPick(r);
    else setDetail({ ...r, dist: r.dist });
  };

  const start = () => {
    if (picks.length === 0) return;
    onStart(picks, picks.length === 1 ? "single" : mode);
  };

  return (
    <div className="relative flex-1 flex flex-col">
      <StarField className="absolute inset-0 w-full h-full opacity-70" />
      <div className="relative flex-1 flex flex-col w-full max-w-md mx-auto px-5 pt-10 pb-6 gap-5">
      <header className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">Yonderful</span>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close" className="size-9 -mr-2 rounded-full flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)]">
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        )}
      </header>

      <h1 className="font-display text-4xl tracking-tight leading-[1.02]">
        {lineMode
          ? !lineStart
            ? "From where?"
            : "To where?"
          : typing
            ? "Where to?"
            : "Where will you wander?"}
      </h1>

      {lineMode && (
        <div className="flex flex-col gap-2 -mt-2">
          <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <Ruler className="w-3.5 h-3.5 text-[var(--accent)]" strokeWidth={1.75} />
            <span>
              {!lineStart
                ? "Where does the line start?"
                : "Now the far point you'll hold the line to."}
            </span>
            <button
              type="button"
              onClick={() => (lineStart ? setLineStart(null) : exitLine())}
              className="ml-auto text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              Back
            </button>
          </div>
          {!lineStart && position && (
            <button
              type="button"
              onClick={() =>
                setLineStart({ name: "Current location", lat: position.lat, lon: position.lon })
              }
              className="self-start rounded-full border border-[var(--accent)]/50 text-[var(--accent)] px-3 py-1.5 text-sm hover:border-[var(--accent)]"
            >
              Start at my current location
            </button>
          )}
          {lineStart && (
            <div className="text-xs text-[var(--muted)]">
              From <span className="text-[var(--foreground)]">{lineStart.name}</span>
              {" · "}
              <button
                type="button"
                onClick={() => setLineStart(null)}
                className="text-[var(--accent)] hover:opacity-80"
              >
                change
              </button>
            </div>
          )}
        </div>
      )}

      <div className="relative">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]"
          strokeWidth={1.75}
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={
            !lineMode
              ? "Where to?"
              : !lineStart
                ? "Search the start…"
                : "Search the far point…"
          }
          className="w-full rounded-full bg-[var(--surface-2)] border border-[var(--border)] pl-11 pr-4 py-3.5 text-base outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]/60"
          inputMode="search"
          enterKeyHint="search"
        />
      </div>

      {/* Building list */}
      {building && (
        <div className="flex flex-col gap-2">
          {picks.map((t, i) => (
            <div key={t.id} className="flex items-center gap-2 py-1.5 border-b border-[var(--border)]">
              <span className="font-mono text-xs text-[var(--accent)] w-5 shrink-0">{mode === "ordered" ? `${i + 1}.` : "·"}</span>
              <span className="flex-1 min-w-0 font-display text-base truncate">{t.name}</span>
              <button type="button" onClick={() => removePick(t.id)} aria-label="Remove" className="size-7 flex items-center justify-center text-[var(--muted)] hover:text-red-400">
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
          ))}
          {picks.length >= 2 && (
            <div className="flex gap-2 text-sm mt-1">
              <ModeChip label="Wander between" active={mode === "collection"} onClick={() => setMode("collection")} />
              <ModeChip label="Step through" active={mode === "ordered"} onClick={() => setMode("ordered")} />
            </div>
          )}
        </div>
      )}

      {/* Search results, your saved places resolve first (type "home") */}
      {typing && (
        <ul className="flex flex-col divide-y divide-[var(--border)] min-h-12">
          {loading && results.length === 0 && (
            <li className="text-sm text-[var(--muted)] py-2 px-1">Searching…</li>
          )}
          {!loading && results.length === 0 && q.trim().length >= 3 && (
            <li className="text-sm text-[var(--muted)] py-2 px-1">No matches. Try adding the town.</li>
          )}
          {!position && results.length > 0 && (
            <li className="text-[11px] text-[var(--muted)] py-2 px-1 flex items-center gap-1.5">
              <MapPin className="w-3 h-3" strokeWidth={1.75} />
              Turn on location to sort by distance.
            </li>
          )}
          {results.map((r, i) => (
            <li key={`${r.lat},${r.lon},${i}`} className="flex items-center gap-3">
              <span
                className={`shrink-0 size-9 rounded-full border flex items-center justify-center ${
                  r.favourite
                    ? "border-[var(--accent)]/40 text-[var(--accent)]"
                    : "border-[var(--border)] text-[var(--muted)]"
                }`}
              >
                {r.favourite ? (
                  <Star className="w-4 h-4" strokeWidth={1.75} fill="var(--accent)" />
                ) : (
                  <MapPin className="w-4 h-4" strokeWidth={1.75} />
                )}
              </span>
              <button type="button" onClick={() => onResultTap(r)} className="flex-1 text-left py-3 min-w-0 hover:text-[var(--accent)]">
                {r.favourite ? (
                  <div className="text-[11px] font-mono uppercase tracking-widest text-[var(--accent)]">
                    Saved{r.dist != null ? ` · ${fmtDist(r.dist)} away` : ""}
                  </div>
                ) : (
                  r.dist != null && <div className="text-[11px] font-mono text-[var(--accent)] tabular-nums">{fmtDist(r.dist)} away</div>
                )}
                <div className="font-display text-lg truncate">{r.name}</div>
                <div className="text-xs text-[var(--muted)] line-clamp-1">{r.label}</div>
              </button>
              <button type="button" onClick={() => addPick(r)} aria-label="Add to a multi-place yonder" className="size-9 shrink-0 flex items-center justify-center text-[var(--muted)] hover:text-[var(--accent)]">
                <Plus className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Idle: your saved places (one tap = go), then the ways to go */}
      {!typing && !building && !lineMode && (
        <div className="flex flex-col gap-6 mt-1">
          {favourites.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
                Your places
              </h2>
              <div className="flex flex-wrap gap-2">
                {favourites.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onStart([toTarget(f)], "single")}
                    className="rounded-full border border-[var(--border)] px-3.5 py-2 text-sm hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    {f.alias || f.name}
                  </button>
                ))}
              </div>
            </section>
          )}
          <div className="grid grid-cols-3 gap-2.5">
            <ModeCard
              icon={Compass}
              title="Just wander"
              accent
              onClick={() => onStart([], "single")}
            />
            <ModeCard icon={MapIcon} title="Maps" onClick={() => router.push("/maps")} />
            <ModeCard icon={Ruler} title="Missions" onClick={() => router.push("/missions")} />
          </div>
        </div>
      )}

      {/* Start bar */}
      {building && (
        <button
          type="button"
          onClick={start}
          className="mt-auto rounded-full bg-[var(--accent)] text-black font-semibold py-3 active:opacity-80"
        >
          {picks.length === 1 ? "Start" : `Yonder ${picks.length} places`}
        </button>
      )}

      {/* Place detail, photo + actions, from a search result */}
      <PlaceDetailSheet
        open={!!detail}
        onClose={() => setDetail(null)}
        place={detail}
        actions={
          detail
            ? [
                {
                  icon: Navigation,
                  label: "Yonder here now",
                  primary: true,
                  onClick: () => {
                    const d = detail;
                    setDetail(null);
                    onStart([toTarget(d)], "single");
                  },
                },
                {
                  icon: Plus,
                  label: "Add to a yonder",
                  onClick: () => {
                    addPick(detail);
                    setDetail(null);
                  },
                },
              ]
            : []
        }
      />
      </div>
    </div>
  );
}

function ModeCard({
  icon: Icon,
  title,
  accent,
  onClick,
}: {
  icon: typeof Compass;
  title: string;
  accent?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-5 text-center transition-colors ${
        accent
          ? "border-[var(--accent)]/50 hover:border-[var(--accent)] bg-[var(--accent)]/[0.04]"
          : "border-[var(--border)] hover:border-[var(--muted)]"
      }`}
    >
      <Icon
        className={`w-6 h-6 ${accent ? "text-[var(--accent)]" : "text-[var(--muted)]"}`}
        strokeWidth={1.5}
      />
      <span className="font-display text-sm leading-tight">{title}</span>
    </button>
  );
}

function ModeChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-2xl border px-3 py-2 text-left transition-colors ${
        active ? "border-[var(--accent)] bg-[var(--surface)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--foreground)] hover:border-[var(--muted)]"
      }`}
    >
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
