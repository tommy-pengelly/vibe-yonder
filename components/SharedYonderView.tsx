"use client";
import { ArrowLeft, Bookmark, Flag, Navigation, Sprout } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AuthModal from "@/components/AuthModal";
import { useGoBack } from "@/components/ui";
import { useAuthUser } from "@/lib/auth";
import { getSharedYonder, reportContent, saveYonderPlaces, setGrub } from "@/lib/data";
import { fmtDist } from "@/lib/geo";
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
        <Link href="/" className="text-sm text-[var(--accent)] hover:opacity-80">Back to Feed</Link>
      </div>
    );
  }

  const onGrub = () => {
    if (!requireAuth("Sign in to grub this yonder.")) return;
    setGrubState((g) => {
      const active = !g.active;
      void setGrub("yonder", y.id, active);
      return { count: g.count + (active ? 1 : -1), active };
    });
  };
  const onSave = () => {
    if (!requireAuth("Sign in to keep this for later.")) return;
    if (saved) return;
    setSaved(true);
    void saveYonderPlaces(y.caption ?? y.area, y.destinations);
  };
  const onLoad = () => {
    if (typeof window === "undefined" || y.destinations.length === 0) return;
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

  const pathD = y.trace.length > 1 ? y.trace.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ") : "";

  return (
    <div className="flex-1 flex flex-col w-full max-w-md mx-auto px-5 pt-6 pb-10 gap-5">
      <button type="button" onClick={goBack} aria-label="Back" className="size-9 -ml-2 rounded-full flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)]">
        <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
      </button>

      <Link href={`/u/${y.handle.slice(1)}`} className="flex items-center gap-3">
        <div className="size-11 shrink-0 rounded-full bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center font-display text-base text-[var(--warm)]">
          {y.who.replace(/[@.]/g, "").slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div className="font-display text-lg leading-tight hover:text-[var(--accent)]">{y.who}</div>
          <div className="text-xs text-[var(--muted)]">{y.handle} · {y.when} · {y.area}</div>
        </div>
      </Link>

      {y.caption && <p className="text-base leading-relaxed text-pretty">{y.caption}</p>}

      <div className="recap-mask w-full" style={{ height: 220 }}>
        {pathD && (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full block">
            <path d={pathD} fill="none" stroke="var(--accent)" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} vectorEffect="non-scaling-stroke" />
          </svg>
        )}
      </div>

      <p className="font-display text-3xl tracking-tight text-center leading-tight">
        Yondered <span className="text-[var(--accent)]">{fmtYondered(y.yondered)}×</span>.
      </p>

      <div className="grid grid-cols-3 gap-3 font-mono tabular-nums text-center">
        <Stat label="Walked" value={fmtDist(y.walked)} />
        <Stat label="Time" value={`${y.mins} min`} />
        <Stat label="Places" value={`${y.places}`} />
      </div>

      <div className="flex items-center gap-2 mt-2">
        <button type="button" onClick={onGrub} aria-pressed={grub.active}
          className={`inline-flex items-center gap-1.5 py-2 px-1 font-mono text-sm tabular-nums ${grub.active ? "text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>
          <Sprout className="w-5 h-5" strokeWidth={1.75} /> {grub.count}
        </button>
        <div className="flex-1" />
        <button type="button" onClick={onSave} disabled={saved}
          className={`inline-flex items-center gap-1.5 text-sm py-2 px-2 ${saved ? "text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>
          <Bookmark className="w-4 h-4" strokeWidth={1.75} /> {saved ? "Saved" : "Save"}
        </button>
        <button type="button" onClick={onLoad}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/60 text-[var(--accent)] text-sm font-semibold px-4 py-2 hover:bg-[var(--accent)] hover:text-black">
          <Navigation className="w-4 h-4" strokeWidth={1.75} /> Yonder this
        </button>
      </div>

      <button type="button" onClick={onReport}
        className="self-center inline-flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-red-400 pt-2">
        <Flag className="w-3 h-3" strokeWidth={1.75} /> Report
      </button>

      <AuthModal open={authOpen} reason={authReason} onClose={() => setAuthOpen(false)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] py-3">
      <div className="text-[10px] uppercase tracking-widest text-[var(--muted)] font-sans">{label}</div>
      <div className="text-lg mt-0.5">{value}</div>
    </div>
  );
}
