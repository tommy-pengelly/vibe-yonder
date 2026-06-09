"use client";
import { Bookmark, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import AuthModal from "@/components/AuthModal";
import { Empty, Loading, YonderCard } from "@/components/feed/Cards";
import { useFeedActions } from "@/components/feed/useFeedActions";
import { useAuthUser } from "@/lib/auth";
import { loadFollowingFeed, loadYonders, saveYonderPlaces } from "@/lib/data";
import { fmtDist } from "@/lib/geo";
import { projectTrack } from "@/lib/stats";
import type { FeedYonder, SavedYonder } from "@/lib/types";

type Tab = "mine" | "following";

export default function Feed() {
  const router = useRouter();
  const { user } = useAuthUser();
  const [tab, setTab] = useState<Tab>("mine");
  const [yonders, setYonders] = useState<SavedYonder[]>([]);
  const [mineSaved, setMineSaved] = useState<Record<string, boolean>>({});
  const [following, setFollowing] = useState<FeedYonder[] | null>(null);

  const a = useFeedActions();

  useEffect(() => {
    let c = false;
    void loadYonders().then((y) => {
      if (!c) setYonders(y);
    });
    return () => {
      c = true;
    };
  }, [user]);

  useEffect(() => {
    if (tab !== "following") return;
    if (!user) {
      setFollowing([]);
      return;
    }
    let c = false;
    setFollowing(null);
    void loadFollowingFeed().then((f) => {
      if (c) return;
      setFollowing(f);
      a.seedGrubs(f);
    });
    return () => {
      c = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, user]);

  const doAgain = (y: SavedYonder) => a.startWalk(y.destinations, y.name);
  const saveForLater = (y: SavedYonder) => {
    if (mineSaved[y.id]) return;
    setMineSaved((p) => ({ ...p, [y.id]: true }));
    void saveYonderPlaces(y.name, y.destinations);
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

  return (
    <>
      <div className="flex-1 flex flex-col w-full max-w-md mx-auto">
        <header className="sticky top-0 z-10 flex flex-col gap-3.5 px-5 pt-10 pb-4 bg-[linear-gradient(var(--background)_78%,transparent)]">
          <span className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">Vibe Yonder</span>
          <div className="flex items-baseline gap-[18px]">
            {(
              [
                ["mine", "Mine"],
                ["following", "Following"],
              ] as [Tab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`font-display text-[22px] tracking-tight transition-colors ${
                  tab === id ? "text-[var(--foreground)]" : "text-[var(--muted)]/55 hover:text-[var(--muted)]"
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

          {tab === "following" &&
            (following === null ? (
              <Loading />
            ) : !user ? (
              <Empty
                title="Follow explorers"
                body="Sign in, then follow people to see where they wander. Never a race."
                cta={{ label: "Sign in", onClick: () => a.requireAuth("Sign in to follow explorers.") }}
              />
            ) : following.length === 0 ? (
              <Empty
                title="Quiet in here"
                body="Follow explorers from Explore or a yonder you love, and their wanders will show up here."
              />
            ) : (
              following.map((y) => (
                <YonderCard
                  key={y.id}
                  y={y}
                  grub={a.gstate(y.id, y)}
                  saved={!!a.saved[y.id]}
                  onGrub={() => a.grub("yonder", y.id)}
                  onSave={() => a.save(y)}
                  onLoad={() => a.startWalk(y.destinations, y.caption ?? y.area)}
                />
              ))
            ))}
        </div>
      </div>
      <AuthModal open={a.authOpen} reason={a.authReason} onClose={() => a.setAuthOpen(false)} />
    </>
  );
}

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
      <Empty title="No yonders yet" body="Go wander, your finished walks live here." cta={{ label: "Start a yonder", onClick: onStart }} />
    );
  }
  return (
    <>
      {month && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">This month</span>
          <div className="font-display text-lg mt-1">
            You wandered <span className="text-[var(--accent)]">{month.km} km</span>
          </div>
          <div className="text-xs text-[var(--muted)] mt-0.5 font-mono tabular-nums">
            {month.yonders} yonders · {month.places} places · avg {month.avg}×
          </div>
        </div>
      )}
      {yonders.map((y) => (
        <div key={y.id} className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] p-4">
          <div className="flex items-center gap-3">
            <TraceThumb track={y.track} />
            <Link href={`/recap/${y.id}`} className="min-w-0 flex-1">
              <div className="font-display text-lg truncate hover:text-[var(--accent)]">{y.name}</div>
              <div className="text-xs text-[var(--muted)] mt-0.5">
                {new Date(y.endedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {fmtDist(y.walked)}
              </div>
            </Link>
            <div className="text-sm font-mono text-[var(--accent)] tabular-nums shrink-0">{y.yondered.toFixed(2)}×</div>
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

function TraceThumb({ track }: { track: SavedYonder["track"] }) {
  const S = 52;
  const d = useMemo(() => {
    const pts = projectTrack(track, S, S, 8);
    if (pts.length < 2) return "";
    return pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  }, [track]);
  return (
    <div className="size-[52px] shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface)]/40 overflow-hidden">
      {d ? (
        <svg viewBox={`0 0 ${S} ${S}`} className="w-full h-full">
          <path d={d} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </div>
  );
}
