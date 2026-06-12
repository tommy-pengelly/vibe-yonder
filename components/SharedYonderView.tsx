"use client";
import { ArrowLeft, Bookmark, Flag, Navigation, Sprout } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AuthModal from "@/components/AuthModal";
import { Trace } from "@/components/ui/viz";
import { useGoBack } from "@/components/ui";
import { useAuthUser } from "@/lib/auth";
import { getSharedYonder, reportContent, saveYonderPlaces, setGrub } from "@/lib/data";
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

  return (
    <div className="flex-1 flex flex-col w-full max-w-md mx-auto px-5 pt-6 pb-10 gap-3">
      <button type="button" onClick={goBack} aria-label="Back" className="size-9 -ml-2 rounded-full flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)]">
        <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
      </button>

      {/* The shared yonder, as an expanded feed card (header → media → stats →
          actions), matching the Community card. */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <Link href={`/u/${y.handle.slice(1)}`} className="flex items-center gap-2.5 px-3.5 pt-3.5">
          <div className="size-10 shrink-0 rounded-full bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center font-display text-sm text-[var(--warm)]">
            {y.who.replace(/[@.]/g, "").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-display text-base leading-tight truncate hover:text-[var(--accent)]">{y.who}</div>
            <div className="text-[11px] text-[var(--muted)]">{y.handle} · {y.when} · {y.area}</div>
          </div>
        </Link>

        {y.caption && <p className="text-sm leading-relaxed mx-3.5 mt-2.5 text-pretty">{y.caption}</p>}

        <div className="relative mt-3">
          <Trace points={y.trace} height={200} />
          <div className="absolute left-4 bottom-2.5 font-mono text-[11px] text-[var(--muted)]">{y.area}</div>
          <div className="absolute right-4 top-3 text-right">
            {y.medal ? (
              <>
                <div className="font-display text-[24px] leading-none text-[var(--accent)] tracking-tight">{MEDAL_LABEL[y.medal]}</div>
                <div className="text-[9px] uppercase tracking-[0.16em] text-[var(--muted)] mt-0.5">Straight line</div>
              </>
            ) : (
              <>
                <div className="font-display text-[28px] leading-none text-[var(--accent)] tabular-nums tracking-tight">{fmtYondered(y.yondered)}×</div>
                <div className="text-[9px] uppercase tracking-[0.16em] text-[var(--muted)] mt-0.5">Yondered</div>
              </>
            )}
          </div>
        </div>

        <div className="font-mono text-[11px] text-[var(--muted)] px-3.5 pt-3 tabular-nums">
          {fmtDist(y.walked)} · {y.mins} min · {y.places} {y.places === 1 ? "place" : "places"} seen
        </div>

        <div className="flex items-center px-3.5 pt-2.5 pb-3.5 gap-2">
          <button type="button" onClick={onGrub} aria-pressed={grub.active} aria-label="Grub"
            className={`inline-flex items-center gap-1.5 py-1.5 font-mono text-[13px] tabular-nums ${grub.active ? "text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>
            <Sprout className="w-[17px] h-[17px]" strokeWidth={1.75} /> {grub.count}
          </button>
          <div className="flex-1" />
          <button type="button" onClick={onSave} disabled={saved}
            className={`inline-flex items-center gap-1.5 text-[13px] py-1.5 px-1 ${saved ? "text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>
            <Bookmark className="w-4 h-4" strokeWidth={1.75} /> {saved ? "Saved" : "Save"}
          </button>
          <button type="button" onClick={onLoad}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/60 text-[var(--accent)] text-xs font-semibold px-3 py-1.5 hover:bg-[var(--accent)] hover:text-black">
            <Navigation className="w-3.5 h-3.5" strokeWidth={1.75} /> Yonder this
          </button>
        </div>
      </div>

      <button type="button" onClick={onReport}
        className="self-center inline-flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-red-400 pt-1">
        <Flag className="w-3 h-3" strokeWidth={1.75} /> Report
      </button>

      <AuthModal open={authOpen} reason={authReason} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
