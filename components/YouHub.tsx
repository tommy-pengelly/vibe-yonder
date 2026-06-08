"use client";
import { Bookmark, ChevronRight, Heart, Map as MapIcon, Settings as SettingsIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import AuthModal from "@/components/AuthModal";
import BottomNav from "@/components/BottomNav";
import { useAuthUser, signOut } from "@/lib/auth";
import { loadFavourites, loadMaps, loadSaved, loadYonders } from "@/lib/data";
import { fmtDist } from "@/lib/geo";
import type { FavouritePlace, SavedYonder, StoredMap, StoredSaved } from "@/lib/types";

export default function YouHub() {
  const { user } = useAuthUser();
  const [yonders, setYonders] = useState<SavedYonder[]>([]);
  const [favourites, setFavourites] = useState<FavouritePlace[]>([]);
  const [maps, setMaps] = useState<StoredMap[]>([]);
  const [saved, setSaved] = useState<StoredSaved[]>([]);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      loadYonders(),
      loadFavourites(),
      loadMaps(),
      loadSaved(),
    ]).then(([y, f, m, s]) => {
      if (cancelled) return;
      setYonders(y);
      setFavourites(f);
      setMaps(m);
      setSaved(s);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <>
      <div className="flex-1 flex flex-col w-full max-w-md mx-auto px-5 pt-12 pb-8 gap-7">
        <header className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
              You
            </span>
            <h1 className="font-display text-4xl tracking-tight leading-none mt-1">
              {user?.email ?? "Guest"}
            </h1>
          </div>
          <Link
            href="/you/settings"
            aria-label="Settings"
            className="size-9 rounded-full border border-[var(--border)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)]"
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

        <Row href="/favourites" Icon={Heart} label="Favourites" count={favourites.length} />
        <Row href="/maps" Icon={MapIcon} label="Maps" count={maps.length} />
        <Row href="/saved" Icon={Bookmark} label="Saved for later" count={saved.length} />

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
              No yonders yet — go wander.
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
      <BottomNav />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
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
