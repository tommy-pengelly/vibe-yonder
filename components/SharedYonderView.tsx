"use client";
import { ArrowLeft, Bookmark, Flag, Navigation } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AuthModal from "@/components/AuthModal";
import { GrubButton, YonderCardBody } from "@/components/feed/Cards";
import { useGoBack } from "@/components/ui";
import { primeOrientation } from "@/hooks/useHeading";
import { useAuthUser } from "@/lib/auth";
import { getSharedYonder, reportContent, saveYonderPlaces, setGrub } from "@/lib/data";
import type { FeedYonder, Target } from "@/lib/types";

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
  const onSave = () => {
    if (!requireAuth("Sign in to keep this for later.")) return;
    if (saved) return;
    setSaved(true);
    void saveYonderPlaces(y.caption ?? y.area, y.destinations);
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
    <div className="flex-1 flex flex-col w-full max-w-md mx-auto px-5 pt-6 pb-10 gap-3">
      <button type="button" onClick={goBack} aria-label="Back" className="size-9 -ml-2 rounded-full flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)]">
        <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
      </button>

      {/* The shared yonder is the same card as the feed (YonderCardBody), shown
          larger and with its own action row (grub · Save · Yonder this). */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <YonderCardBody y={y} traceHeight={200} />

        <div className="flex items-center px-3.5 pt-2.5 pb-3.5 gap-2">
          <GrubButton count={grub.count} active={grub.active} onToggle={onGrub} />
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
