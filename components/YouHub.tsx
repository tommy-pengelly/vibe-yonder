"use client";
import { Bell, ChevronRight, Footprints, Heart, Map as MapIcon, Settings as SettingsIcon, Telescope } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AuthModal from "@/components/AuthModal";
import FollowRequests from "@/components/FollowRequests";
import YonderPlusSheet from "@/components/YonderPlusSheet";
import { useEntitlement } from "@/hooks/useEntitlement";
import { useAuthUser, signOut } from "@/lib/auth";
import { loadFavourites, loadMaps, loadYonders, unreadNotificationCount } from "@/lib/data";
import { fmtDist } from "@/lib/geo";
import type { FavouritePlace, SavedYonder } from "@/lib/types";

export default function YouHub() {
  const { user } = useAuthUser();
  const [yonders, setYonders] = useState<SavedYonder[]>([]);
  const [favourites, setFavourites] = useState<FavouritePlace[]>([]);
  const [mapsCount, setMapsCount] = useState(0);
  const [unread, setUnread] = useState(0);
  const [authOpen, setAuthOpen] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const { premium } = useEntitlement();

  // Lifetime exploration story — places seen is the headline number.
  const stats = useMemo(() => {
    const places = new Set<string>();
    let metres = 0;
    for (const y of yonders) {
      metres += y.walked;
      for (const d of y.destinations) {
        places.add(`${d.name}|${d.lat.toFixed(4)},${d.lon.toFixed(4)}`);
      }
    }
    return { placesSeen: places.size, yonders: yonders.length, km: metres / 1000 };
  }, [yonders]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      loadYonders(),
      loadFavourites(),
      loadMaps(),
      unreadNotificationCount(),
    ]).then(([y, f, m, n]) => {
      if (cancelled) return;
      setYonders(y);
      setFavourites(f);
      setMapsCount(m.length);
      setUnread(n);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <>
      <div className="flex-1 flex flex-col w-full max-w-md mx-auto px-5 pt-12 pb-8 gap-7">
        <header className="flex items-center justify-between gap-3">
          <ProfileHeader
            username={user?.username}
            displayName={user?.displayName}
            email={user?.email}
          />
          <Link
            href="/you/settings"
            aria-label="Settings"
            className="size-9 shrink-0 rounded-full border border-[var(--border)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <SettingsIcon className="w-4 h-4" strokeWidth={1.75} />
          </Link>
        </header>

        {!user && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/40 px-4 py-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm">
                Sign in to keep your yonders, favourites and lists across
                devices.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAuthOpen(true)}
              className="rounded-full bg-[var(--accent)] text-black text-sm font-semibold px-4 py-2 active:opacity-80 shrink-0"
            >
              Sign in
            </button>
          </div>
        )}

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

        {stats.yonders > 0 && (
          <Row
            href="/ways"
            Icon={Footprints}
            label="Your yonders"
            count={stats.yonders}
          />
        )}
        <Row href="/maps" Icon={MapIcon} label="Maps" count={mapsCount} />
        <Row href="/favourites" Icon={Heart} label="Favourites" count={favourites.length} />

        <button
          type="button"
          onClick={() => setPlusOpen(true)}
          className="w-full flex items-center gap-3 py-3 border-b border-[var(--border)] text-left hover:text-[var(--accent)] [&_svg]:hover:text-[var(--accent)]"
        >
          <Telescope className="w-5 h-5 text-[var(--accent)]" strokeWidth={1.75} />
          <div className="flex-1 font-display text-lg">Yonder+</div>
          <div className="text-xs text-[var(--muted)]">
            {premium ? "Active" : "Go further"}
          </div>
          <ChevronRight className="w-4 h-4 text-[var(--muted)]" strokeWidth={1.75} />
        </button>
        {user && <Row href="/you/notifications" Icon={Bell} label="Notifications" count={unread} />}

        {user && <FollowRequests />}

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
              History
            </h2>
            {yonders.length > 0 && (
              <span className="text-[10px] text-[var(--muted)] tabular-nums">
                {yonders.length}
              </span>
            )}
          </div>

          {yonders.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No yonders yet, go wander.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--border)]">
              {yonders.slice(0, 12).map((y) => (
                <li key={y.id}>
                  <Link
                    href={`/recap/${y.id}`}
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
                        · {fmtDist(y.walked)}
                      </div>
                    </div>
                    <div className="text-xs font-mono text-[var(--accent)] tabular-nums shrink-0">
                      {y.yondered.toFixed(2)}×
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

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
      <YonderPlusSheet open={plusOpen} onClose={() => setPlusOpen(false)} />
    </>
  );
}

function ProfileHeader({
  username,
  displayName,
  email,
}: {
  username?: string;
  displayName?: string;
  email?: string;
}) {
  const name = displayName ?? email ?? "Guest";
  const initials = (displayName ?? username ?? email ?? "G").replace(/[@.]/g, "").slice(0, 2).toUpperCase();
  const inner = (
    <>
      <div className="size-14 shrink-0 rounded-full bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center font-display text-xl text-[var(--warm)]">
        {initials}
      </div>
      <div className="min-w-0">
        <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">You</span>
        <div className="font-display text-2xl tracking-tight leading-tight truncate">{name}</div>
        {username && <div className="text-xs text-[var(--accent)]">@{username} · View profile</div>}
      </div>
    </>
  );
  return username ? (
    <Link href={`/u/${username}`} className="flex items-center gap-3 min-w-0 flex-1">
      {inner}
    </Link>
  ) : (
    <div className="flex items-center gap-3 min-w-0 flex-1">{inner}</div>
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

function Row({
  href,
  Icon,
  label,
  count,
  disabled,
}: {
  href: string;
  Icon: typeof Heart;
  label: string;
  count: number;
  disabled?: boolean;
}) {
  const content = (
    <>
      <Icon className="w-5 h-5 text-[var(--muted)]" strokeWidth={1.75} />
      <div className="flex-1 font-display text-lg">{label}</div>
      {count > 0 && (
        <div className="text-xs font-mono text-[var(--muted)] tabular-nums">
          {count}
        </div>
      )}
      <ChevronRight className="w-4 h-4 text-[var(--muted)]" strokeWidth={1.75} />
    </>
  );
  const className =
    "w-full flex items-center gap-3 py-3 border-b border-[var(--border)]";
  if (disabled) {
    return (
      <div
        aria-disabled="true"
        className={`${className} opacity-50 cursor-not-allowed`}
      >
        {content}
      </div>
    );
  }
  return (
    <Link
      href={href}
      className={`${className} hover:text-[var(--accent)] [&_svg]:hover:text-[var(--accent)]`}
    >
      {content}
    </Link>
  );
}
