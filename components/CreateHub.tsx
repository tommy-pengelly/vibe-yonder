"use client";
import { Compass, Map as MapIcon, Navigation, Plus, Ruler, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { usePlaceSearch } from "@/hooks/usePlaceSearch";
import BottomSheet from "@/components/ui/BottomSheet";
import { SegmentedTabs } from "@/components/ui";
import PlaceDetailSheet, { type PlaceLite } from "@/components/PlaceDetailSheet";
import { loadCommunity, loadFavourites, loadMaps } from "@/lib/data";
import { fmtDist } from "@/lib/geo";
import type {
  FavouritePlace,
  FeedMap,
  Fix,
  RankedResult,
  StoredMap,
  PlayMode,
  Target,
  YonderMode,
} from "@/lib/types";

type MapsTab = "mine" | "community";

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
  onClose: () => void;
}) {
  const router = useRouter();
  const { q, setQ, results, loading } = usePlaceSearch(position);
  const [picks, setPicks] = useState<Target[]>([]);
  const [mode, setMode] = useState<YonderMode>("collection");
  const [maps, setMaps] = useState<StoredMap[]>([]);
  const [favourites, setFavourites] = useState<FavouritePlace[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mapsTab, setMapsTab] = useState<MapsTab>("mine");
  const [communityMaps, setCommunityMaps] = useState<FeedMap[] | null>(null);
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
  const idle = q.trim().length < 3;

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

  // Lazy-load community maps the first time the Community tab is opened.
  useEffect(() => {
    if (!pickerOpen || mapsTab !== "community" || communityMaps !== null) return;
    let c = false;
    void loadCommunity().then((r) => !c && setCommunityMaps(r.maps));
    return () => {
      c = true;
    };
  }, [pickerOpen, mapsTab, communityMaps]);

  const startCommunityMap = (m: FeedMap) => {
    if (!m.destinations.length) return;
    const targets = m.destinations.map((d) => toTarget(d));
    onStart(targets, targets.length === 1 ? "single" : "collection", {
      mapId: m.mapId,
      name: m.name,
    });
  };

  return (
    <div className="flex-1 flex flex-col w-full max-w-md mx-auto px-5 pt-10 pb-6 gap-5">
      <header className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">Yonderful</span>
        <button type="button" onClick={onClose} aria-label="Close" className="size-9 -mr-2 rounded-full flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)]">
          <X className="w-4 h-4" strokeWidth={1.75} />
        </button>
      </header>

      <h1 className="font-display text-4xl tracking-tight leading-[0.95]">
        {!lineMode ? "Where to?" : !lineStart ? "From where?" : "To where?"}
      </h1>

      {lineMode && (
        <div className="flex flex-col gap-2 -mt-2">
          <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <Ruler className="w-3.5 h-3.5 text-[var(--accent)]" strokeWidth={1.75} />
            <span>
              {!lineStart
                ? "Where does the line start?"
                : "The far point you'll hold the line to."}
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
            </div>
          )}
        </div>
      )}

      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={
          !lineMode
            ? "Search a place to wander to…"
            : !lineStart
              ? "Search the start…"
              : "Search the far point…"
        }
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

      {/* Idle: stacked modes */}
      {idle && !building && !lineMode && (
        <div className="flex flex-col gap-2">
          <ModeRow
            icon={Compass}
            title="Just wander"
            sub="No destination, eyes up, see what you find"
            accent
            onClick={() => onStart([], "single")}
          />
          <ModeRow
            icon={MapIcon}
            title="Maps"
            sub={maps.length ? "Yours, the community's, or make one" : "Browse the community or build your own"}
            onClick={() => setPickerOpen(true)}
          />
          <ModeRow
            icon={Ruler}
            title="Mission"
            sub="Hold a straight line A to B, earn a medal, race the board"
            onClick={() => setLineMode(true)}
          />

          {favourites.length > 0 && (
            <section className="flex flex-col gap-2 mt-4">
              <h2 className="text-[10px] uppercase tracking-widest text-[var(--muted)]">Places</h2>
              <div className="flex flex-wrap gap-2">
                {favourites.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onStart([toTarget(f)], "single")}
                    className="rounded-full border border-[var(--border)] px-3 py-1.5 text-sm hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    {f.alias || f.name}
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

      {/* Maps picker, your maps, the community's, or make a new one */}
      <BottomSheet open={pickerOpen} onClose={() => setPickerOpen(false)} title="Maps" minHeightVh={60}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <SegmentedTabs<MapsTab>
            variant="pill"
            value={mapsTab}
            onChange={setMapsTab}
            tabs={[
              { value: "mine", label: "Mine" },
              { value: "community", label: "Community" },
            ]}
          />
          <button
            type="button"
            onClick={() => {
              setPickerOpen(false);
              router.push("/maps/new");
            }}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--accent)] hover:border-[var(--accent)]"
          >
            <Plus className="w-4 h-4" strokeWidth={1.75} />
            New
          </button>
        </div>

        {mapsTab === "mine" ? (
          maps.length === 0 ? (
            <p className="text-sm text-[var(--muted)] py-8 text-center">
              No maps yet, make one, or browse the community.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--border)]">
              {maps.map((m) => {
                const remaining = m.items.filter((i) => !i.visited).length;
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setPickerOpen(false);
                        startMap(m);
                      }}
                      disabled={remaining === 0}
                      className="w-full text-left py-3 hover:text-[var(--accent)] disabled:opacity-40"
                    >
                      <div className="font-display text-lg truncate">{m.name}</div>
                      <div className="text-xs text-[var(--muted)] mt-0.5">
                        {m.mode === "ordered" ? "Step through" : "Wander between"} ·{" "}
                        {remaining === 0 ? "all seen" : `${remaining} left`}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        ) : communityMaps === null ? (
          <p className="text-sm text-[var(--muted)] py-8 text-center">Loading…</p>
        ) : communityMaps.length === 0 ? (
          <p className="text-sm text-[var(--muted)] py-8 text-center">
            No public maps yet.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--border)]">
            {communityMaps.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => {
                    setPickerOpen(false);
                    startCommunityMap(m);
                  }}
                  className="w-full text-left py-3 hover:text-[var(--accent)]"
                >
                  <div className="font-display text-lg truncate">{m.name}</div>
                  <div className="text-xs text-[var(--muted)] mt-0.5">
                    {m.who} · {m.places} place{m.places === 1 ? "" : "s"}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </BottomSheet>

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
  );
}

function ModeRow({
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
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors ${
        disabled
          ? "border-[var(--border)] opacity-50 cursor-default"
          : accent
            ? "border-[var(--accent)]/50 hover:border-[var(--accent)]"
            : "border-[var(--border)] hover:border-[var(--muted)]"
      }`}
    >
      <Icon
        className={`w-5 h-5 shrink-0 ${accent && !disabled ? "text-[var(--accent)]" : "text-[var(--muted)]"}`}
        strokeWidth={1.75}
      />
      <div className="min-w-0">
        <div className="font-display text-base leading-tight">{title}</div>
        <div className="text-xs text-[var(--muted)] truncate">{sub}</div>
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
