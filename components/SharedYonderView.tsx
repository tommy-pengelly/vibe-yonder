"use client";
import { ArrowLeft, Bookmark, Flag, MapPin, Navigation } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AuthModal from "@/components/AuthModal";
import { Avatar, GrubButton, yonderSavePlan } from "@/components/feed/Cards";
import { Trace } from "@/components/ui/viz";
import { useGoBack } from "@/components/ui";
import { primeOrientation } from "@/hooks/useHeading";
import { useAuthUser } from "@/lib/auth";
import {
  getSharedYonder,
  reportContent,
  saveMission,
  saveYonderPlaces,
  setGrub,
} from "@/lib/data";
import { fmtDist } from "@/lib/geo";
import { MEDAL_LABEL } from "@/lib/straightline";
import type { FeedYonder, Target } from "@/lib/types";

function fmtYondered(v: number): string {
  return v >= 10 ? Math.round(v).toString() : v.toFixed(v >= 2 ? 1 : 2);
}

export default function SharedYonderView({ id }: { id: string }) {
  const router = useRouter();
  const goBack = useGoBack("/");
  const { user } = useAuthUser();
  const [y, setY] = useState<FeedYonder | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [grub, setGrubState] = useState({ count: 0, active: false });
  const [saved, setSaved] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authReason, setAuthReason] = useState<string>();

  useEffect(() => {
    let c = false;
    void getSharedYonder(id).then((r) => {
      if (c) return;
      setY(r);
      if (r) setGrubState({ count: r.grubs, active: r.grubbed });
      setLoaded(true);
    });
    return () => {
      c = true;
    };
  }, [id]);

  const requireAuth = (reason: string) => {
    if (user) return true;
    setAuthReason(reason);
    setAuthOpen(true);
    return false;
  };

  if (!y) {
    if (!loaded) return <div className="flex-1" />;
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-5 gap-3">
        <p className="text-sm text-[var(--muted)]">This yonder isn&apos;t available.</p>
        <Link href="/community" className="text-sm text-[var(--accent)] hover:opacity-80">Back to Feed</Link>
      </div>
    );
  }

  const onGrub = () => {
    if (!requireAuth("Sign in to grub this yonder.")) return;
    setGrubState((g) => {
      const active = !g.active;
      void setGrub("post", y.id, active);
      return { count: g.count + (active ? 1 : -1), active };
    });
  };
  // Saving keeps the PLAN under the yonder: its mission, or a map of its places
  // (created if needed). Hidden when the wander has nothing to keep (ambient).
  const savePlan = yonderSavePlan(y);
  const onSave = () => {
    if (!requireAuth("Sign in to keep this for later.")) return;
    if (saved || !savePlan) return;
    setSaved(true);
    if (savePlan.kind === "mission" && y.missionId) void saveMission(y.missionId, true);
    else void saveYonderPlaces(y.caption ?? y.area, y.destinations);
  };
  const onLoad = () => {
    if (typeof window === "undefined" || y.destinations.length === 0) return;
    void primeOrientation(); // grab the compass on this tap so the scope spins
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
      JSON.stringify({ mode: targets.length > 1 ? "collection" : "single", targets, name: y.caption ?? y.area }),
    );
    router.push("/walk");
  };
  const onReport = () => {
    if (!requireAuth("Sign in to report.")) return;
    void reportContent("yonder", y.id, "user report");
  };

  return (
    <div className="flex-1 flex flex-col w-full max-w-md mx-auto px-5 pt-6 pb-10 gap-5">
      <button type="button" onClick={goBack} aria-label="Back" className="size-9 -ml-2 rounded-full flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)]">
        <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
      </button>

      {/* Author */}
      <Link href={`/u/${y.handle.slice(1)}`} className="flex items-center gap-3 min-w-0">
        <Avatar name={y.who} />
        <div className="min-w-0">
          <div className="font-display text-lg leading-tight truncate hover:text-[var(--accent)]">{y.who}</div>
          <div className="text-xs text-[var(--muted)] truncate">
            {y.handle} · {y.when} · {y.area}
          </div>
        </div>
      </Link>

      {y.caption && (
        <p className="font-display text-2xl tracking-tight leading-snug text-pretty">
          {y.caption}
        </p>
      )}

      {/* The trace, as a hero. A memento of the wander, never the real route. */}
      <div className="relative rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <Trace points={y.trace} height={260} />
        <div className="absolute left-4 bottom-3 font-mono text-[11px] text-[var(--muted)]">{y.area}</div>
        <div className="absolute right-4 top-3 text-right">
          {y.medal ? (
            <>
              <div className="font-display text-[26px] leading-none text-[var(--accent)] tracking-tight">{MEDAL_LABEL[y.medal]}</div>
              <div className="text-[9px] uppercase tracking-[0.16em] text-[var(--muted)] mt-0.5">Straight line</div>
            </>
          ) : (
            <>
              <div className="font-display text-[30px] leading-none text-[var(--accent)] tabular-nums tracking-tight">{fmtYondered(y.yondered)}×</div>
              <div className="text-[9px] uppercase tracking-[0.16em] text-[var(--muted)] mt-0.5">Yondered</div>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {y.medal ? (
          <>
            <Tile label="Result" value={MEDAL_LABEL[y.medal]} hero />
            <Tile label="Walked" value={fmtDist(y.walked)} />
            <Tile label="Time" value={`${y.mins} min`} />
            <Tile label="Places seen" value={String(y.places)} />
          </>
        ) : (
          <>
            <Tile label="Walked" value={fmtDist(y.walked)} />
            <Tile label="Time" value={`${y.mins} min`} />
            <Tile label="Places seen" value={String(y.places)} />
            <Tile label="Yondered" value={`${fmtYondered(y.yondered)}×`} hero />
          </>
        )}
      </div>

      {/* Places seen, names only (a shared post carries no real coordinates). */}
      {y.destinations.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">Places seen</span>
          <ul className="flex flex-col divide-y divide-[var(--border)]">
            {y.destinations.map((d, i) => (
              <li key={`${d.name}-${i}`} className="flex items-center gap-3 py-2.5">
                <MapPin className="w-4 h-4 shrink-0 text-[var(--muted)]" strokeWidth={1.75} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">{d.name}</div>
                  {d.label && <div className="text-xs text-[var(--muted)] truncate">{d.label}</div>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <GrubButton count={grub.count} active={grub.active} onToggle={onGrub} />
        <div className="flex-1" />
        {savePlan && (
          <button type="button" onClick={onSave} disabled={saved}
            className={`inline-flex items-center gap-1.5 text-[13px] py-1.5 px-1 ${saved ? "text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>
            <Bookmark className="w-4 h-4" strokeWidth={1.75} /> {saved ? "Saved" : savePlan.label}
          </button>
        )}
        <button type="button" onClick={onLoad}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/60 text-[var(--accent)] text-sm font-semibold px-4 py-2 hover:bg-[var(--accent)] hover:text-black">
          <Navigation className="w-4 h-4" strokeWidth={1.75} /> Yonder this
        </button>
      </div>

      <button type="button" onClick={onReport}
        className="self-center inline-flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-red-400 pt-1">
        <Flag className="w-3 h-3" strokeWidth={1.75} /> Report
      </button>

      <AuthModal open={authOpen} reason={authReason} onClose={() => setAuthOpen(false)} />
    </div>
  );
}

function Tile({ label, value, hero }: { label: string; value: string; hero?: boolean }) {
  return (
    <div
      className={`rounded-2xl border border-[var(--border)] px-4 py-3.5 flex flex-col ${
        hero ? "bg-[var(--surface)]" : "bg-transparent"
      }`}
    >
      <div className="text-[10px] uppercase tracking-widest text-[var(--muted)]">{label}</div>
      <div className={`font-display tabular-nums mt-1 ${hero ? "text-3xl text-[var(--accent)]" : "text-2xl"}`}>
        {value}
      </div>
    </div>
  );
}
