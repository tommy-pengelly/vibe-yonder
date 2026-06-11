"use client";
import {
  Bell,
  Footprints,
  Map as MapIcon,
  Plus,
  Ruler,
  Search,
  Settings as SettingsIcon,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import AuthModal from "@/components/AuthModal";
import FavouritesView from "@/components/FavouritesView";
import FollowRequests from "@/components/FollowRequests";
import PlacePhoto from "@/components/PlacePhoto";
import { EmptyState, InfiniteScroll, SegmentedTabs, StickyBar } from "@/components/ui";
import { DotMap, Trace } from "@/components/ui/viz";
import { useAuthUser, signOut } from "@/lib/auth";
import {
  loadMaps,
  loadMyMissions,
  loadYonders,
  type Mission,
  unreadNotificationCount,
} from "@/lib/data";
import { fmtDist, spanMeters, toUnitBox } from "@/lib/geo";
import { MEDAL_LABEL } from "@/lib/straightline";
import type { SavedYonder, StoredMap } from "@/lib/types";

type Tab = "yonders" | "maps" | "missions" | "favourites";

export default function YouHub() {
  const { user } = useAuthUser();
  const [yonders, setYonders] = useState<SavedYonder[]>([]);
  const [unread, setUnread] = useState(0);
  const [authOpen, setAuthOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("yonders");

  const stats = useMemo(() => {
    const places = new Set<string>();
    let metres = 0;
    for (const y of yonders) {
      metres += y.walked ?? 0;
      for (const d of y.destinations ?? []) {
        if (d?.lat == null || d?.lon == null) continue;
        places.add(`${d.name}|${d.lat.toFixed(4)},${d.lon.toFixed(4)}`);
      }
    }
    return { placesSeen: places.size, yonders: yonders.length, km: metres / 1000 };
  }, [yonders]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadYonders(), unreadNotificationCount()]).then(
      ([y, n]) => {
        if (cancelled) return;
        setYonders(y);
        setUnread(n);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <>
      <div className="flex-1 flex flex-col w-full max-w-md mx-auto px-5 pt-12 pb-8 gap-6">
        {/* Profile summary */}
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-14 shrink-0 rounded-full bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center font-display text-xl text-[var(--warm)]">
              {(user?.displayName ?? user?.username ?? user?.email ?? "G")
                .replace(/[@.]/g, "")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
                You
              </span>
              <div className="font-display text-2xl tracking-tight leading-tight truncate">
                {user?.displayName ?? user?.email ?? "Guest"}
              </div>
              {user?.username && (
                <div className="text-xs text-[var(--accent)]">@{user.username}</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {user && (
              <Link
                href="/you/notifications"
                aria-label="Notifications"
                className="relative size-9 rounded-full border border-[var(--border)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                <Bell className="w-4 h-4" strokeWidth={1.75} />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-[var(--accent)]" />
                )}
              </Link>
            )}
            <Link
              href="/you/settings"
              aria-label="Settings"
              className="size-9 rounded-full border border-[var(--border)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <SettingsIcon className="w-4 h-4" strokeWidth={1.75} />
            </Link>
          </div>
        </header>

        {stats.yonders > 0 && (
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Places seen" value={stats.placesSeen.toString()} hero />
            <Stat label="Yonders" value={stats.yonders.toString()} />
            <Stat
              label="Wandered"
              value={
                stats.km >= 10 ? `${Math.round(stats.km)}km` : `${stats.km.toFixed(1)}km`
              }
            />
          </div>
        )}

        {user?.username ? (
          <Link
            href={`/u/${user.username}`}
            className="rounded-full border border-[var(--border)] text-[var(--foreground)] py-2.5 text-center text-sm font-medium hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            See your public profile
          </Link>
        ) : !user ? (
          <button
            type="button"
            onClick={() => setAuthOpen(true)}
            className="rounded-full bg-[var(--accent)] text-black py-2.5 text-center text-sm font-semibold active:opacity-80"
          >
            Sign in to keep your yonders across devices
          </button>
        ) : null}

        {user && <FollowRequests />}

        <StickyBar>
          <SegmentedTabs<Tab>
            variant="underline"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "yonders", label: "Yonders" },
              { value: "maps", label: "Maps" },
              { value: "missions", label: "Missions" },
              { value: "favourites", label: "Places" },
            ]}
          />
        </StickyBar>

        {tab === "yonders" && <YondersTab yonders={yonders} />}
        {tab === "maps" && <MapsTab />}
        {tab === "missions" && <MissionsTab />}
        {tab === "favourites" && <PlacesTab yonders={yonders} />}

        {user && (
          <div className="mt-auto flex items-center justify-center pt-4">
            <button
              type="button"
              onClick={() => void signOut()}
              className="text-xs text-[var(--muted)] hover:text-red-400"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}

// ----- Tabs -----

// One consistent create affordance for every tab: a small "+ label" link.
function TabCreate({
  label,
  href,
  onClick,
}: {
  label: string;
  href?: string;
  onClick?: () => void;
}) {
  const cls =
    "inline-flex items-center gap-1.5 text-sm text-[var(--accent)] hover:opacity-80";
  const inner = (
    <>
      <Plus className="w-4 h-4" strokeWidth={1.75} /> {label}
    </>
  );
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

// A small filter input for a Me tab.
function TabSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] px-3 focus-within:border-[var(--accent)]">
      <Search className="w-4 h-4 text-[var(--muted)] shrink-0" strokeWidth={1.75} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent py-2.5 text-sm outline-none placeholder:text-[var(--muted)]/60"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear"
          className="text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <X className="w-4 h-4" strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}

const matches = (q: string, ...fields: (string | undefined)[]) => {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  return fields.some((f) => f?.toLowerCase().includes(t));
};

function YondersTab({ yonders }: { yonders: SavedYonder[] }) {
  const [shown, setShown] = useState(8);
  const [q, setQ] = useState("");
  const filtered = yonders.filter((y) => matches(q, y.name));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        {yonders.length > 0 ? (
          <Link
            href="/ways"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <Footprints className="w-4 h-4" strokeWidth={1.75} /> All your ways
          </Link>
        ) : (
          <span />
        )}
        <TabCreate label="New yonder" href="/walk" />
      </div>
      {yonders.length === 0 ? (
        <EmptyState
          icon={Footprints}
          title="No yonders yet"
          body="Set off on a wander, and every walk you take lands here."
        />
      ) : (
        <>
          {yonders.length > 4 && (
            <TabSearch value={q} onChange={setQ} placeholder="Search your yonders…" />
          )}
          {filtered.slice(0, shown).map((y) => (
            <HistoryCard key={y.id} y={y} />
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-[var(--muted)] py-2">No yonders match.</p>
          )}
          <InfiniteScroll
            hasMore={shown < filtered.length}
            loading={false}
            onMore={() => setShown((s) => s + 8)}
          />
        </>
      )}
    </div>
  );
}

function MapsTab() {
  const [maps, setMaps] = useState<StoredMap[] | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    let c = false;
    void loadMaps().then((m) => !c && setMaps(m));
    return () => {
      c = true;
    };
  }, []);
  if (maps === null) return null;
  const filtered = maps.filter((m) => matches(q, m.name));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <TabCreate label="New map" href="/maps/new" />
      </div>
      {maps.length === 0 ? (
        <EmptyState
          icon={MapIcon}
          title="No maps yet"
          body="Build a set of places to wander between, ready to set off any time."
        />
      ) : (
        <>
          {maps.length > 4 && (
            <TabSearch value={q} onChange={setQ} placeholder="Search your maps…" />
          )}
          {filtered.length === 0 && (
            <p className="text-sm text-[var(--muted)] py-2">No maps match.</p>
          )}
          {filtered.map((m) => {
          const remaining = m.items.filter((i) => !i.visited).length;
          return (
            <Link
              key={m.id}
              href={`/maps/${m.id}`}
              className="block rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden hover:border-[var(--accent)]/50"
            >
              <div className="px-4 pt-4 pb-1">
                <div className="font-display text-xl tracking-tight truncate">
                  {m.name}
                </div>
                <div className="text-xs text-[var(--warm)] mt-0.5">
                  {m.mode === "ordered" ? "Step through" : "Wander between"} ·{" "}
                  {remaining === 0 ? "all seen" : `${remaining} left`}
                </div>
              </div>
              {m.items.length > 0 && (
                <DotMap
                  points={toUnitBox(m.items)}
                  height={120}
                  scaleLabel={
                    m.items.length > 1
                      ? `${fmtDist(spanMeters(m.items))} across`
                      : undefined
                  }
                />
              )}
            </Link>
          );
        })}
        </>
      )}
    </div>
  );
}

function MissionsTab() {
  const router = useRouter();
  const [missions, setMissions] = useState<Mission[] | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    let c = false;
    void loadMyMissions().then((m) => !c && setMissions(m));
    return () => {
      c = true;
    };
  }, []);
  // Missions are made from a straight line: open the launcher in line mode.
  const newMission = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("vibe-yonder.createMode", "line");
    }
    router.push("/walk");
  };
  if (missions === null) return null;
  const filtered = missions.filter((m) => matches(q, m.name ?? "Straight-line mission"));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <TabCreate label="New mission" onClick={newMission} />
      </div>
      {missions.length === 0 ? (
        <EmptyState
          icon={Ruler}
          title="No missions yet"
          body="Walk a straight line from A to B, then turn it into a mission others can race."
        />
      ) : (
        <>
          {missions.length > 4 && (
            <TabSearch value={q} onChange={setQ} placeholder="Search your missions…" />
          )}
          {filtered.length === 0 && (
            <p className="text-sm text-[var(--muted)] py-2">No missions match.</p>
          )}
          {filtered.map((m) => (
            <Link
              key={m.id}
              href={`/missions/${m.id}`}
              className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 hover:border-[var(--accent)]/50"
            >
              <Ruler className="w-5 h-5 text-[var(--accent)] shrink-0" strokeWidth={1.75} />
              <div className="min-w-0 flex-1">
                <div className="font-display text-lg truncate">
                  {m.name ?? "Straight-line mission"}
                </div>
                <div className="text-xs text-[var(--muted)]">
                  {fmtDist(m.distanceM)} · {m.attempts ?? 0}{" "}
                  {m.attempts === 1 ? "attempt" : "attempts"}
                </div>
              </div>
              <span className="text-[10px] uppercase tracking-widest text-[var(--muted)] shrink-0">
                {m.mine ? "Yours" : "Racing"}
              </span>
            </Link>
          ))}
        </>
      )}
    </div>
  );
}

// Places = your saved favourites (top) + the places you've actually visited
// (deduped from your yonders), with one search over both.
function PlacesTab({ yonders }: { yonders: SavedYonder[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const visited = useMemo(() => {
    const m = new Map<
      string,
      { name: string; label?: string; lat: number; lon: number; count: number }
    >();
    for (const y of yonders)
      for (const d of y.destinations ?? []) {
        if (d?.lat == null || d?.lon == null) continue;
        const key = `${d.name}|${d.lat.toFixed(4)},${d.lon.toFixed(4)}`;
        const e = m.get(key);
        if (e) e.count++;
        else m.set(key, { name: d.name, label: d.label, lat: d.lat, lon: d.lon, count: 1 });
      }
    return [...m.values()].sort((a, b) => b.count - a.count);
  }, [yonders]);
  const visitedShown = visited.filter((p) => matches(q, p.name, p.label));

  const yonderTo = (p: { name: string; label?: string; lat: number; lon: number }) => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      "vibe-yonder.start",
      JSON.stringify({
        mode: "single",
        targets: [
          {
            id: crypto.randomUUID(),
            name: p.name,
            label: p.label,
            lat: p.lat,
            lon: p.lon,
            visited: false,
          },
        ],
        name: p.name,
      }),
    );
    router.push("/walk");
  };

  return (
    <div className="flex flex-col gap-5">
      <TabSearch value={q} onChange={setQ} placeholder="Search your places…" />
      <FavouritesView embedded query={q} />
      {visited.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
            Visited
          </h2>
          {visitedShown.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No visited places match.</p>
          ) : (
            visitedShown.map((p) => (
              <button
                key={`${p.name}-${p.lat.toFixed(4)}`}
                type="button"
                onClick={() => yonderTo(p)}
                className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-left hover:border-[var(--accent)]/50"
              >
                <PlacePhoto
                  lat={p.lat}
                  lon={p.lon}
                  name={p.name}
                  keepPlaceholder
                  className="size-12 rounded-xl shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-display text-lg truncate">{p.name}</div>
                  <div className="text-xs text-[var(--muted)]">
                    visited {p.count}
                    {p.count === 1 ? " time" : " times"}
                  </div>
                </div>
              </button>
            ))
          )}
        </section>
      )}
    </div>
  );
}

function HistoryCard({ y }: { y: SavedYonder }) {
  const pts = toUnitBox((y.track ?? []).map((p) => ({ lat: p.lat, lon: p.lon })));
  const sl = y.play === "straightline" ? y.straightLine : undefined;
  return (
    <Link
      href={`/recap/${y.id}`}
      className="block rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden hover:border-[var(--accent)]/50 transition-colors"
    >
      <div className="px-4 pt-3.5 pb-1 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-lg truncate">{y.name}</div>
          <div className="text-xs text-[var(--muted)] mt-0.5">
            {new Date(y.endedAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}{" "}
            · {fmtDist(y.walked ?? 0)}
          </div>
        </div>
        <div className="font-display text-lg text-[var(--accent)] tabular-nums shrink-0">
          {sl ? MEDAL_LABEL[sl.medal] : `${(y.yondered ?? 1).toFixed(1)}×`}
        </div>
      </div>
      {pts.length > 1 && (
        <Trace points={pts} height={110} scaleLabel={fmtDist(y.walked ?? 0)} />
      )}
    </Link>
  );
}

function Stat({
  label,
  value,
  hero,
}: {
  label: string;
  value: string;
  hero?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-[var(--border)] px-3 py-3 flex flex-col ${
        hero ? "bg-[var(--surface)]" : ""
      }`}
    >
      <div
        className={`font-display tabular-nums ${hero ? "text-3xl text-[var(--accent)]" : "text-2xl"}`}
      >
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-[var(--muted)] mt-0.5">
        {label}
      </div>
    </div>
  );
}
