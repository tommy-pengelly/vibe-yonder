"use client";
import { Bookmark, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import AuthModal from "@/components/AuthModal";
import BottomNav from "@/components/BottomNav";
import { useAuthUser } from "@/lib/auth";
import { loadYonders, pushSaved } from "@/lib/data";
import { fmtDist } from "@/lib/geo";
import { projectTrack } from "@/lib/stats";
import type { SavedYonder, Target } from "@/lib/types";

type Tab = "mine" | "following" | "community";

export default function Feed() {
  const router = useRouter();
  const { user } = useAuthUser();
  const [tab, setTab] = useState<Tab>("mine");
  const [yonders, setYonders] = useState<SavedYonder[]>([]);
  const [savedIds, setSavedIds] = useState<Record<string, boolean>>({});
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadYonders().then((y) => {
      if (!cancelled) setYonders(y);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const doAgain = (y: SavedYonder) => {
    if (typeof window === "undefined") return;
    const targets: Target[] = y.destinations.map((d) => ({
      id: crypto.randomUUID(),
      name: d.name,
      label: d.label,
      lat: d.lat,
      lon: d.lon,
      visited: false,
    }));
    window.sessionStorage.setItem(
      "vibe-yonder.start",
      JSON.stringify({
        mode: y.mode,
        targets,
        listId: y.listId,
        name: y.name,
      }),
    );
    router.push("/walk");
  };

  const saveForLater = (y: SavedYonder) => {
    if (savedIds[y.id]) return;
    setSavedIds((p) => ({ ...p, [y.id]: true }));
    if (y.destinations.length === 1) {
      const d = y.destinations[0];
      void pushSaved({
        kind: "place",
        refId: y.id,
        name: d.name,
        lat: d.lat,
        lon: d.lon,
      });
    } else {
      void pushSaved({ kind: "list", refId: y.id, name: y.name });
    }
  };

  return (
    <>
      <div className="flex-1 flex flex-col w-full max-w-md mx-auto px-5 pt-10 pb-8 gap-5">
        <header className="flex flex-col gap-4">
          <span className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
            Vibe Yonder
          </span>
          <div className="flex items-center gap-5 text-sm">
            <TabButton label="Mine" active={tab === "mine"} onClick={() => setTab("mine")} />
            <TabButton
              label="Following"
              active={tab === "following"}
              onClick={() => setTab("following")}
            />
            <TabButton
              label="Community"
              active={tab === "community"}
              onClick={() => setTab("community")}
            />
          </div>
        </header>

        {tab === "mine" && (
          <Mine
            yonders={yonders}
            savedIds={savedIds}
            onDoAgain={doAgain}
            onSaveForLater={saveForLater}
            onStart={() => router.push("/walk")}
          />
        )}

        {tab === "following" && (
          <Placeholder
            title="Follow explorers"
            body="The Following feed arrives with the social update — wanders from the people you follow, never a race."
            showSignIn={!user}
            onSignIn={() => setAuthOpen(true)}
          />
        )}

        {tab === "community" && (
          <Placeholder
            title="Discover the community"
            body="Browse public yonders and collections near you. Coming with the social update."
            showSignIn={!user}
            onSignIn={() => setAuthOpen(true)}
          />
        )}
      </div>
      <BottomNav />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}

function Mine({
  yonders,
  savedIds,
  onDoAgain,
  onSaveForLater,
  onStart,
}: {
  yonders: SavedYonder[];
  savedIds: Record<string, boolean>;
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
    <ul className="flex flex-col gap-4">
      {yonders.map((y) => (
        <li
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
              disabled={savedIds[y.id]}
              className="flex-1 rounded-full border border-[var(--border)] text-[var(--foreground)] py-2 text-sm flex items-center justify-center gap-2 hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40 disabled:hover:border-[var(--border)] disabled:hover:text-[var(--foreground)]"
            >
              <Bookmark className="w-4 h-4" strokeWidth={1.75} />
              {savedIds[y.id] ? "Saved" : "Save for later"}
            </button>
          </div>
        </li>
      ))}
    </ul>
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

function Placeholder({
  title,
  body,
  showSignIn,
  onSignIn,
}: {
  title: string;
  body: string;
  showSignIn: boolean;
  onSignIn: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-16 px-2">
      <h2 className="font-display text-2xl tracking-tight">{title}</h2>
      <p className="text-sm text-[var(--muted)] max-w-xs leading-relaxed">{body}</p>
      {showSignIn && (
        <button
          type="button"
          onClick={onSignIn}
          className="mt-1 rounded-full bg-[var(--accent)] text-black text-sm font-semibold px-5 py-2.5 active:opacity-80"
        >
          Sign in
        </button>
      )}
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`font-display text-xl tracking-tight transition-colors ${
        active
          ? "text-[var(--foreground)]"
          : "text-[var(--muted)]/50 hover:text-[var(--muted)]"
      }`}
    >
      {label}
    </button>
  );
}
