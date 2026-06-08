"use client";
import { Bookmark, Copy, Navigation, RotateCcw, Sprout } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import AuthModal from "@/components/AuthModal";
import BottomNav from "@/components/BottomNav";
import { useAuthUser } from "@/lib/auth";
import { loadYonders, pushSaved } from "@/lib/data";
import {
  COMMUNITY_MAPS,
  COMMUNITY_YONDERS,
  DOTS,
  FOLLOWING,
  fmtYondered,
  TRACES,
  type DemoDest,
  type DemoMap,
  type DemoYonder,
} from "@/lib/feedDemo";
import { fmtDist } from "@/lib/geo";
import { projectTrack } from "@/lib/stats";
import type { SavedYonder, Target } from "@/lib/types";

type Tab = "mine" | "following" | "community";

export default function Feed() {
  const router = useRouter();
  const { user } = useAuthUser();
  const [tab, setTab] = useState<Tab>("mine");
  const [yonders, setYonders] = useState<SavedYonder[]>([]);
  const [mineSaved, setMineSaved] = useState<Record<string, boolean>>({});
  const [authOpen, setAuthOpen] = useState(false);
  const [authReason, setAuthReason] = useState<string | undefined>();

  // Demo social interaction state (ephemeral — no backend yet).
  const seedGrubs = () => {
    const g: Record<string, { count: number; active: boolean }> = {};
    [...FOLLOWING, ...COMMUNITY_YONDERS, ...COMMUNITY_MAPS].forEach((x) => {
      g[x.id] = { count: x.grubs, active: x.grubbed };
    });
    return g;
  };
  const [grubs, setGrubs] = useState(seedGrubs);
  const [savedDemo, setSavedDemo] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    void loadYonders().then((y) => {
      if (!cancelled) setYonders(y);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const requireAuth = (reason: string) => {
    if (user) return true;
    setAuthReason(reason);
    setAuthOpen(true);
    return false;
  };

  const grub = (id: string) => {
    if (!requireAuth("Sign in to grub a yonder you loved.")) return;
    setGrubs((g) => {
      const cur = g[id];
      const active = !cur.active;
      return { ...g, [id]: { count: cur.count + (active ? 1 : -1), active } };
    });
  };
  const saveDemo = (id: string) => {
    if (!requireAuth("Sign in to keep this for later.")) return;
    setSavedDemo((s) => ({ ...s, [id]: true }));
  };
  const duplicate = () => requireAuth("Sign in to duplicate this into your maps.");

  const startWalk = (targets: Target[], name: string, mode: "single" | "collection") => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      "vibe-yonder.start",
      JSON.stringify({ mode, targets, name }),
    );
    router.push("/walk");
  };
  const loadYonder = (y: DemoYonder) =>
    startWalk(
      [{ id: crypto.randomUUID(), name: y.dest.name, lat: y.dest.lat, lon: y.dest.lon, visited: false }],
      y.dest.name,
      "single",
    );
  const loadMap = (m: DemoMap) =>
    startWalk(
      m.destinations.map((d: DemoDest) => ({
        id: crypto.randomUUID(),
        name: d.name,
        lat: d.lat,
        lon: d.lon,
        visited: false,
      })),
      m.name,
      m.destinations.length > 1 ? "collection" : "single",
    );

  // ----- Mine tab (real data) -----
  const doAgain = (y: SavedYonder) => {
    const targets: Target[] = y.destinations.map((d) => ({
      id: crypto.randomUUID(),
      name: d.name,
      label: d.label,
      lat: d.lat,
      lon: d.lon,
      visited: false,
    }));
    startWalk(targets, y.name, y.destinations.length > 1 ? "collection" : "single");
  };
  const saveForLater = (y: SavedYonder) => {
    if (mineSaved[y.id]) return;
    setMineSaved((p) => ({ ...p, [y.id]: true }));
    if (y.destinations.length === 1) {
      const d = y.destinations[0];
      void pushSaved({ kind: "place", refId: y.id, name: d.name, lat: d.lat, lon: d.lon });
    } else {
      void pushSaved({ kind: "map", refId: y.id, name: y.name });
    }
  };

  const month = useMemo(() => {
    const now = new Date();
    const mine = yonders.filter((v) => {
      const d = new Date(v.endedAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    if (mine.length === 0) return null;
    const km = mine.reduce((s, v) => s + v.walked, 0) / 1000;
    const places = mine.reduce((s, v) => s + v.destinations.length, 0);
    const avg = mine.reduce((s, v) => s + v.yondered, 0) / mine.length;
    return { km: km.toFixed(1), yonders: mine.length, places, avg: avg.toFixed(1) };
  }, [yonders]);

  const gstate = (id: string) => grubs[id] ?? { count: 0, active: false };

  return (
    <>
      <div className="flex-1 flex flex-col w-full max-w-md mx-auto">
        <header className="sticky top-0 z-10 flex flex-col gap-3.5 px-5 pt-10 pb-4 bg-[linear-gradient(var(--background)_78%,transparent)]">
          <span className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
            Vibe Yonder
          </span>
          <div className="flex items-baseline gap-[18px]">
            {(
              [
                ["mine", "Mine"],
                ["following", "Following"],
                ["community", "Community"],
              ] as [Tab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`font-display text-[22px] tracking-tight transition-colors ${
                  tab === id
                    ? "text-[var(--foreground)]"
                    : "text-[var(--muted)]/55 hover:text-[var(--muted)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        <div className="flex flex-col gap-3.5 px-5 pt-1 pb-6">
          {tab === "mine" && (
            <Mine
              yonders={yonders}
              month={month}
              mineSaved={mineSaved}
              onDoAgain={doAgain}
              onSaveForLater={saveForLater}
              onStart={() => router.push("/walk")}
            />
          )}

          {tab === "following" && (
            <>
              {!user && (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex items-center justify-between gap-3">
                  <p className="text-sm text-[var(--warm)]">
                    Following a few explorers. Sign in to follow more and keep your feed.
                  </p>
                  <button
                    type="button"
                    onClick={() => requireAuth("Sign in to follow explorers.")}
                    className="shrink-0 rounded-full bg-[var(--accent)] text-black text-sm font-semibold px-4 py-2 active:opacity-80"
                  >
                    Sign in
                  </button>
                </div>
              )}
              {FOLLOWING.map((y) => (
                <YonderCard
                  key={y.id}
                  y={y}
                  grub={gstate(y.id)}
                  saved={!!savedDemo[y.id]}
                  onGrub={() => grub(y.id)}
                  onSave={() => saveDemo(y.id)}
                  onLoad={() => loadYonder(y)}
                />
              ))}
            </>
          )}

          {tab === "community" && (
            <Community
              grubs={grubs}
              savedDemo={savedDemo}
              onGrub={grub}
              onSaveDemo={saveDemo}
              onLoadYonder={loadYonder}
              onLoadMap={loadMap}
              onDuplicate={duplicate}
            />
          )}
        </div>
      </div>
      <BottomNav />
      <AuthModal
        open={authOpen}
        reason={authReason}
        onClose={() => setAuthOpen(false)}
      />
    </>
  );
}

// ----- Mine -----
function Mine({
  yonders,
  month,
  mineSaved,
  onDoAgain,
  onSaveForLater,
  onStart,
}: {
  yonders: SavedYonder[];
  month: { km: string; yonders: number; places: number; avg: string } | null;
  mineSaved: Record<string, boolean>;
  onDoAgain: (y: SavedYonder) => void;
  onSaveForLater: (y: SavedYonder) => void;
  onStart: () => void;
}) {
  if (yonders.length === 0) {
    return (
      <div className="flex flex-col items-center text-center gap-3 py-16">
        <p className="text-sm text-[var(--muted)]">No yonders yet — go wander.</p>
        <button
          type="button"
          onClick={onStart}
          className="rounded-full bg-[var(--accent)] text-black text-sm font-semibold px-5 py-2.5 active:opacity-80"
        >
          Start a yonder
        </button>
      </div>
    );
  }
  return (
    <>
      {month && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
            This month
          </span>
          <div className="font-display text-lg mt-1">
            You wandered <span className="text-[var(--accent)]">{month.km} km</span>
          </div>
          <div className="text-xs text-[var(--muted)] mt-0.5 font-mono tabular-nums">
            {month.yonders} yonders · {month.places} places · avg {month.avg}×
          </div>
        </div>
      )}
      {yonders.map((y) => (
        <div
          key={y.id}
          className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] p-4"
        >
          <div className="flex items-center gap-3">
            <TraceThumb track={y.track} />
            <Link href={`/recap/${y.id}`} className="min-w-0 flex-1">
              <div className="font-display text-lg truncate hover:text-[var(--accent)]">
                {y.name}
              </div>
              <div className="text-xs text-[var(--muted)] mt-0.5">
                {new Date(y.endedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}{" "}
                · {fmtDist(y.walked)}
              </div>
            </Link>
            <div className="text-sm font-mono text-[var(--accent)] tabular-nums shrink-0">
              {y.yondered.toFixed(2)}×
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onDoAgain(y)}
              className="flex-1 rounded-full border border-[var(--border)] text-[var(--foreground)] py-2 text-sm flex items-center justify-center gap-2 hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              <RotateCcw className="w-4 h-4" strokeWidth={1.75} />
              Do again
            </button>
            <button
              type="button"
              onClick={() => onSaveForLater(y)}
              disabled={mineSaved[y.id]}
              className="flex-1 rounded-full border border-[var(--border)] text-[var(--foreground)] py-2 text-sm flex items-center justify-center gap-2 hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40 disabled:hover:border-[var(--border)] disabled:hover:text-[var(--foreground)]"
            >
              <Bookmark className="w-4 h-4" strokeWidth={1.75} />
              {mineSaved[y.id] ? "Saved" : "Save for later"}
            </button>
          </div>
        </div>
      ))}
    </>
  );
}

// ----- Community -----
function Community({
  grubs,
  savedDemo,
  onGrub,
  onSaveDemo,
  onLoadYonder,
  onLoadMap,
  onDuplicate,
}: {
  grubs: Record<string, { count: number; active: boolean }>;
  savedDemo: Record<string, boolean>;
  onGrub: (id: string) => void;
  onSaveDemo: (id: string) => void;
  onLoadYonder: (y: DemoYonder) => void;
  onLoadMap: (m: DemoMap) => void;
  onDuplicate: () => void;
}) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const gstate = (id: string) => grubs[id] ?? { count: 0, active: false };
  const maps = COMMUNITY_MAPS.filter(
    (m) => !term || (m.name + m.who).toLowerCase().includes(term),
  );
  const yonders = COMMUNITY_YONDERS.filter(
    (y) => !term || (y.who + y.handle + y.area + (y.caption ?? "")).toLowerCase().includes(term),
  );
  return (
    <>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search the community — a place or area…"
        className="w-full bg-transparent border-b border-[var(--border)] px-1 py-2.5 text-base outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]/60"
        inputMode="search"
      />
      <span className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)] mt-1">
        Maps to yonder near you
      </span>
      {maps.map((m) => (
        <MapCard
          key={m.id}
          m={m}
          grub={gstate(m.id)}
          onGrub={() => onGrub(m.id)}
          onLoad={() => onLoadMap(m)}
          onDuplicate={onDuplicate}
        />
      ))}
      <span className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)] mt-2">
        Gloriously lost lately
      </span>
      {yonders.map((y) => (
        <YonderCard
          key={y.id}
          y={y}
          grub={gstate(y.id)}
          saved={!!savedDemo[y.id]}
          onGrub={() => onGrub(y.id)}
          onSave={() => onSaveDemo(y.id)}
          onLoad={() => onLoadYonder(y)}
        />
      ))}
    </>
  );
}

// ----- Cards & bits -----
function YonderCard({
  y,
  grub,
  saved,
  onGrub,
  onSave,
  onLoad,
}: {
  y: DemoYonder;
  grub: { count: number; active: boolean };
  saved: boolean;
  onGrub: () => void;
  onSave: () => void;
  onLoad: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="flex items-center gap-2.5 px-3.5 pt-3.5">
        <Avatar name={y.who} />
        <div className="min-w-0 flex-1">
          <div className="font-display text-base leading-tight">{y.who}</div>
          <div className="text-[11px] text-[var(--muted)]">
            {y.handle} · {y.when}
          </div>
        </div>
      </div>
      {y.caption && (
        <p className="text-sm leading-relaxed mx-3.5 mt-2.5 text-pretty">{y.caption}</p>
      )}
      <div className="relative mt-3">
        <Trace variant={y.trace} height={150} />
        <div className="absolute left-4 bottom-2.5 font-mono text-[11px] text-[var(--muted)]">
          {y.area}
        </div>
        <div className="absolute right-4 top-3 text-right">
          <div className="font-display text-[26px] leading-none text-[var(--accent)] tabular-nums tracking-tight">
            {fmtYondered(y.yondered)}×
          </div>
          <div className="text-[9px] uppercase tracking-[0.16em] text-[var(--muted)] mt-0.5">
            Yondered
          </div>
        </div>
      </div>
      <div className="font-mono text-[11px] text-[var(--muted)] px-3.5 pt-3 tabular-nums">
        {fmtDist(y.walked)}  ·  {y.mins} min  ·  {y.places} {y.places === 1 ? "place" : "places"} seen
      </div>
      <div className="flex items-center gap-2 px-3.5 pt-2 pb-3.5">
        <GrubButton count={grub.count} active={grub.active} onToggle={onGrub} />
        <div className="flex-1" />
        <button
          type="button"
          onClick={onSave}
          disabled={saved}
          className={`inline-flex items-center gap-1.5 text-[13px] py-1.5 px-1 ${
            saved ? "text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          <Bookmark className="w-4 h-4" strokeWidth={1.75} />
          {saved ? "Saved" : "Save"}
        </button>
        <LoadButton onClick={onLoad} label="Yonder this" />
      </div>
    </div>
  );
}

function MapCard({
  m,
  grub,
  onGrub,
  onLoad,
  onDuplicate,
}: {
  m: DemoMap;
  grub: { count: number; active: boolean };
  onGrub: () => void;
  onLoad: () => void;
  onDuplicate: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="flex items-start justify-between gap-2.5 px-3.5 pt-3.5">
        <div className="min-w-0">
          <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
            Collection
          </span>
          <div className="font-display text-[19px] mt-1 leading-tight">{m.name}</div>
          <div className="text-[11px] text-[var(--muted)] mt-0.5">{m.who}</div>
        </div>
        <GrubButton count={grub.count} active={grub.active} onToggle={onGrub} />
      </div>
      <div className="mt-3">
        <DotMap variant={m.dots} height={110} />
      </div>
      <div className="font-mono text-[11px] text-[var(--muted)] px-3.5 pt-2.5 tabular-nums">
        {m.places} places · yondered by {m.yonderedBy}
      </div>
      <div className="flex items-center gap-2 px-3.5 pt-2.5 pb-3.5">
        <LoadButton onClick={onLoad} label="Yonder this map" />
        <button
          type="button"
          onClick={onDuplicate}
          className="inline-flex items-center gap-1.5 text-[13px] text-[var(--muted)] hover:text-[var(--foreground)] py-1.5 px-1"
        >
          <Copy className="w-[15px] h-[15px]" strokeWidth={1.75} />
          Duplicate
        </button>
      </div>
    </div>
  );
}

function LoadButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/60 bg-black/30 backdrop-blur-sm text-[var(--accent)] text-xs font-semibold px-3 py-1.5 hover:bg-[var(--accent)] hover:text-black"
    >
      <Navigation className="w-3.5 h-3.5" strokeWidth={1.75} />
      {label}
    </button>
  );
}

function GrubButton({
  count,
  active,
  onToggle,
}: {
  count: number;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 py-1.5 font-mono text-[13px] tabular-nums transition-colors ${
        active ? "text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
      }`}
    >
      <Sprout className="w-[17px] h-[17px]" strokeWidth={1.75} />
      {count}
    </button>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name.replace(/[@.]/g, "").slice(0, 2).toUpperCase();
  return (
    <div className="size-10 shrink-0 rounded-full bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center font-display text-sm text-[var(--warm)] tracking-tight">
      {initials}
    </div>
  );
}

function Trace({
  variant,
  height = 150,
  fill = true,
}: {
  variant: number;
  height?: number;
  fill?: boolean;
}) {
  const d = TRACES[variant % TRACES.length];
  return (
    <div className="recap-mask w-full" style={{ height }}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio={fill ? "none" : "xMidYMid meet"}
        className="w-full h-full block"
        aria-hidden="true"
      >
        <path
          d={d}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={fill ? 1.4 : 2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.85}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

function DotMap({ variant, height = 110 }: { variant: number; height?: number }) {
  const dots = DOTS[variant % DOTS.length];
  return (
    <div className="recap-mask w-full" style={{ height }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full block" aria-hidden="true">
        {dots.map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r={4.5} fill="none" stroke="var(--accent)" strokeWidth={1} opacity={0.35} vectorEffect="non-scaling-stroke" />
            <circle cx={x} cy={y} r={1.8} fill="var(--accent)" vectorEffect="non-scaling-stroke" />
          </g>
        ))}
      </svg>
    </div>
  );
}

function TraceThumb({ track }: { track: SavedYonder["track"] }) {
  const S = 52;
  const d = useMemo(() => {
    const pts = projectTrack(track, S, S, 8);
    if (pts.length < 2) return "";
    return pts
      .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
      .join(" ");
  }, [track]);
  return (
    <div className="size-[52px] shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface)]/40 overflow-hidden">
      {d ? (
        <svg viewBox={`0 0 ${S} ${S}`} className="w-full h-full">
          <path
            d={d}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </div>
  );
}
