"use client";
import { Compass, Map as MapIcon, Plus, Ruler, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { usePlaceSearch } from "@/hooks/usePlaceSearch";
import { loadFavourites, loadMaps } from "@/lib/data";
import { fmtDist } from "@/lib/geo";
import { CATEGORIES, type NearbyPlace } from "@/lib/nearby";
import type {
  FavouritePlace,
  Fix,
  RankedResult,
  StoredMap,
  Target,
  YonderMode,
} from "@/lib/types";

type StartOpts = {
  mapId?: string;
  mapItemIdByTargetId?: Record<string, string>;
  name?: string;
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
  onClose: () => void;
}) {
  const router = useRouter();
  const { q, setQ, results, loading } = usePlaceSearch(position);
  const [picks, setPicks] = useState<Target[]>([]);
  const [mode, setMode] = useState<YonderMode>("collection");
  const [maps, setMaps] = useState<StoredMap[]>([]);
  const [favourites, setFavourites] = useState<FavouritePlace[]>([]);
  const [cat, setCat] = useState<string | null>(null);
  const [nearby, setNearby] = useState<NearbyPlace[] | null>(null);

  const building = picks.length > 0;
  const idle = q.trim().length < 3;

  // Category discovery: "find me a café/park/viewpoint" near the dot.
  useEffect(() => {
    if (!cat || !position) return;
    let c = false;
    setNearby(null);
    void fetch(
      `/api/nearby?category=${cat}&lat=${position.lat}&lon=${position.lon}`,
    )
      .then((r) => (r.ok ? r.json() : []))
      .then((d: NearbyPlace[]) => !c && setNearby(d))
      .catch(() => !c && setNearby([]));
    return () => {
      c = true;
    };
  }, [cat, position]);

  useEffect(() => {
    let c = false;
    void loadMaps().then((m) => !c && setMaps(m));
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
    if (building) addPick(r);
    else onStart([toTarget(r)], "single");
  };

  const start = () => {
    if (picks.length === 0) return;
    onStart(picks, picks.length === 1 ? "single" : mode);
  };

  const startMap = (m: StoredMap) => {
    const active = m.items.filter((i) => !i.visited);
    if (active.length === 0) return;
    const targets = active.map((i) => toTarget(i));
    const mapItemIdByTargetId: Record<string, string> = {};
    targets.forEach((t, k) => (mapItemIdByTargetId[t.id] = active[k].id));
    onStart(targets, active.length === 1 ? "single" : m.mode, {
      mapId: m.id,
      mapItemIdByTargetId,
      name: m.name,
    });
  };

  return (
    <div className="flex-1 flex flex-col w-full max-w-md mx-auto px-5 pt-10 pb-6 gap-5">
      <header className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">Vibe Yonder</span>
        <button type="button" onClick={onClose} aria-label="Close" className="size-9 -mr-2 rounded-full flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)]">
          <X className="w-4 h-4" strokeWidth={1.75} />
        </button>
      </header>

      <h1 className="font-display text-4xl tracking-tight leading-[0.95]">Where to?</h1>

      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search a place to wander to…"
        className="w-full bg-transparent border-b border-[var(--border)] px-1 py-3 text-lg outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]/60"
        inputMode="search"
        enterKeyHint="search"
      />

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

      {/* Search results */}
      {!idle && (
        <ul className="flex flex-col divide-y divide-[var(--border)] min-h-12">
          {loading && <li className="text-sm text-[var(--muted)] py-2 px-1">Searching…</li>}
          {!loading && results.length === 0 && (
            <li className="text-sm text-[var(--muted)] py-2 px-1">No matches. Try adding the town.</li>
          )}
          {results.map((r, i) => (
            <li key={`${r.lat},${r.lon},${i}`} className="flex items-center gap-2">
              <button type="button" onClick={() => onResultTap(r)} className="flex-1 text-left py-3 min-w-0 hover:text-[var(--accent)]">
                {r.dist != null && <div className="text-[11px] font-mono text-[var(--accent)] tabular-nums">{fmtDist(r.dist)} away</div>}
                <div className="font-display text-lg truncate">{r.name}</div>
                <div className="text-xs text-[var(--muted)] line-clamp-1">{r.label}</div>
              </button>
              <button type="button" onClick={() => addPick(r)} aria-label="Add to a multi-place yonder" className="size-9 flex items-center justify-center text-[var(--muted)] hover:text-[var(--accent)]">
                <Plus className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Idle: pick a mode / find a place / load a map */}
      {idle && !building && (
        <div className="flex flex-col gap-6">
          {/* Modes — a place is the search above; these are the rest. */}
          <div className="grid grid-cols-2 gap-2">
            <ModeCard
              icon={Compass}
              title="Just wander"
              sub="No destination"
              accent
              onClick={() => onStart([], "single")}
            />
            <ModeCard
              icon={Ruler}
              title="Straight line"
              sub="Coming soon"
              disabled
            />
          </div>

          {/* Category discovery — wander toward something nearby. */}
          {position && (
            <section className="flex flex-col gap-3">
              <h2 className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
                Find me a…
              </h2>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setCat(cat === c.key ? null : c.key)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      cat === c.key
                        ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--surface)]"
                        : "border-[var(--border)] text-[var(--foreground)] hover:border-[var(--muted)]"
                    }`}
                  >
                    <span aria-hidden>{c.emoji}</span> {c.label}
                  </button>
                ))}
              </div>
              {cat && (
                <ul className="flex flex-col divide-y divide-[var(--border)] min-h-12">
                  {nearby === null && (
                    <li className="text-sm text-[var(--muted)] py-2">Looking nearby…</li>
                  )}
                  {nearby?.length === 0 && (
                    <li className="text-sm text-[var(--muted)] py-2">
                      Nothing tagged nearby — try another, or just wander.
                    </li>
                  )}
                  {nearby?.map((p, i) => (
                    <li key={`${p.lat},${p.lon},${i}`}>
                      <button
                        type="button"
                        onClick={() => onResultTap({ name: p.name, label: "", lat: p.lat, lon: p.lon, importance: 0 } as RankedResult)}
                        className="w-full text-left py-3 hover:text-[var(--accent)]"
                      >
                        {p.dist != null && (
                          <div className="text-[11px] font-mono text-[var(--accent)] tabular-nums">
                            {fmtDist(p.dist)} away
                          </div>
                        )}
                        <div className="font-display text-base truncate">{p.name}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <button
            type="button"
            onClick={() => router.push("/maps/new")}
            className="flex items-center gap-3 rounded-2xl border border-[var(--border)] px-4 py-3 text-left hover:border-[var(--accent)]"
          >
            <MapIcon className="w-5 h-5 text-[var(--muted)]" strokeWidth={1.75} />
            <div>
              <div className="font-display text-base">New map</div>
              <div className="text-xs text-[var(--muted)]">A set of places to wander between — saved for any time.</div>
            </div>
          </button>

          {maps.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-[10px] uppercase tracking-widest text-[var(--muted)]">Your maps</h2>
              <ul className="flex flex-col divide-y divide-[var(--border)]">
                {maps.map((m) => {
                  const remaining = m.items.filter((i) => !i.visited).length;
                  return (
                    <li key={m.id}>
                      <button type="button" onClick={() => startMap(m)} disabled={remaining === 0} className="w-full text-left py-3 hover:text-[var(--accent)] disabled:opacity-40">
                        <div className="font-display text-lg truncate">{m.name}</div>
                        <div className="text-xs text-[var(--muted)] mt-0.5">
                          {m.mode === "ordered" ? "Step through" : "Wander between"} · {remaining === 0 ? "all seen" : `${remaining} left`}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {favourites.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-[10px] uppercase tracking-widest text-[var(--muted)]">Favourites</h2>
              <div className="flex flex-wrap gap-2">
                {favourites.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onStart([toTarget(f)], "single")}
                    className="rounded-full border border-[var(--border)] px-3 py-1.5 text-sm hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </section>
          )}
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
    </div>
  );
}

function ModeCard({
  icon: Icon,
  title,
  sub,
  accent,
  disabled,
  onClick,
}: {
  icon: typeof Compass;
  title: string;
  sub: string;
  accent?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col gap-2 rounded-2xl border px-4 py-3.5 text-left transition-colors ${
        disabled
          ? "border-[var(--border)] opacity-50 cursor-default"
          : accent
            ? "border-[var(--accent)]/50 hover:border-[var(--accent)]"
            : "border-[var(--border)] hover:border-[var(--muted)]"
      }`}
    >
      <Icon
        className={`w-5 h-5 ${accent && !disabled ? "text-[var(--accent)]" : "text-[var(--muted)]"}`}
        strokeWidth={1.75}
      />
      <div>
        <div className="font-display text-base leading-tight">{title}</div>
        <div className="text-xs text-[var(--muted)]">{sub}</div>
      </div>
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
