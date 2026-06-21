"use client";
import { Check, Eye, Globe, Lock, Share2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuthUser } from "@/lib/auth";
import { publishYonder, shareStatus } from "@/lib/data";
import { useSettings } from "@/lib/settings";
import type { SavedYonder } from "@/lib/types";
import AuthModal from "./AuthModal";
import BottomSheet from "./ui/BottomSheet";

// null = not shared yet (no post). "private" = unlisted: a post exists so a link
// opens, but it lists in no feed.
type Vis = "public" | "followers" | "private" | null;

/** The recap's outward controls: a Share button (send a friend the link to the
 * obfuscated yonder) and a Visibility control (public / followers / private).
 * Publishing writes an obfuscated copy (the precise track never leaves the
 * owner); the home zone is removed and the start/finish trimmed. Gates on
 * sign-in. */
export default function ShareControl({ saved }: { saved: SavedYonder }) {
  const { user } = useAuthUser();
  const { settings } = useSettings();
  const [status, setStatus] = useState<Vis>(null);
  const [open, setOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [caption, setCaption] = useState(saved.caption ?? "");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let c = false;
    if (!user) {
      setStatus(null);
      return;
    }
    void shareStatus(saved.id).then((s) => {
      if (!c) setStatus(s?.visibility ?? null);
    });
    return () => {
      c = true;
    };
  }, [user, saved.id]);

  const visLabel =
    status === "public" ? "Public" : status === "followers" ? "Followers" : "Private";

  // Share the link with a friend. The link is independent of your feed setting:
  // anyone with it can open the (obfuscated) yonder. If you haven't shared yet,
  // a link needs a post, so we create an UNLISTED one (visibility private, in no
  // feed) without touching whatever visibility you'd chosen, then hand off to
  // the native share sheet.
  const onShare = async () => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setBusy(true);
    let s = await shareStatus(saved.id);
    if (!s) {
      await publishYonder(saved, {
        visibility: "private",
        caption,
        zone: settings.privacyZone,
      });
      s = await shareStatus(saved.id);
      setStatus("private");
    }
    setBusy(false);
    if (!s?.postId || typeof window === "undefined") return;
    const url = `${window.location.origin}/yonder/${s.postId}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: saved.name, text: `A yonder: ${saved.name}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      // user dismissed the share sheet; nothing to do
    }
  };

  const openVisibility = () => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setOpen(true);
  };

  // Set the FEED visibility. "private" = unlisted: keep the post (so a shared
  // link still opens) but drop it from every feed; if there's no post yet,
  // there's nothing to list, so it stays unshared.
  const choose = async (vis: "public" | "followers" | "private") => {
    setBusy(true);
    if (vis === "private") {
      if (status !== null) {
        await publishYonder(saved, { visibility: "private", caption, zone: settings.privacyZone });
        setStatus("private");
      }
    } else {
      await publishYonder(saved, { visibility: vis, caption, zone: settings.privacyZone });
      setStatus(vis);
    }
    setBusy(false);
    setOpen(false);
  };

  return (
    <>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void onShare()}
          disabled={busy}
          className="flex-1 rounded-full border border-[var(--border)] text-[var(--foreground)] py-2.5 flex items-center justify-center gap-2 hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
        >
          <Share2 className="w-4 h-4" strokeWidth={1.75} />
          {copied ? "Link copied" : "Share"}
        </button>
        <button
          type="button"
          onClick={openVisibility}
          className="flex-1 rounded-full border border-[var(--border)] text-[var(--foreground)] py-2.5 flex items-center justify-center gap-2 hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          <Eye className="w-4 h-4" strokeWidth={1.75} />
          {visLabel}
        </button>
      </div>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Who can see this yonder">
        <p className="text-xs text-[var(--muted)] -mt-1 leading-relaxed">
          You share the places + an obfuscated trace memento, never your route.
          Your start and finish near home stay hidden.
        </p>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Say a word about the wander… (optional)"
          rows={2}
          className="w-full resize-none rounded-xl bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]/60"
        />
        <div className="flex flex-col gap-2">
          <Choice icon={Globe} label="Public" sub="Anyone can discover it in the feed" active={status === "public"} onClick={() => choose("public")} busy={busy} />
          <Choice icon={Users} label="Followers" sub="In the feed for people who follow you" active={status === "followers"} onClick={() => choose("followers")} busy={busy} />
          <Choice icon={Lock} label="Private" sub="In no feed, but a shared link still opens" active={status === "private" || status === null} onClick={() => choose("private")} busy={busy} />
        </div>
      </BottomSheet>

      <AuthModal open={authOpen} reason="Sign in to share your yonder." onClose={() => setAuthOpen(false)} />
    </>
  );
}

function Choice({
  icon: Icon,
  label,
  sub,
  active,
  onClick,
  busy,
}: {
  icon: typeof Globe;
  label: string;
  sub: string;
  active: boolean;
  onClick: () => void;
  busy: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors disabled:opacity-60 ${
        active ? "border-[var(--accent)] bg-[var(--surface-2)]" : "border-[var(--border)] hover:border-[var(--muted)]"
      }`}
    >
      <Icon className={`w-5 h-5 shrink-0 ${active ? "text-[var(--accent)]" : "text-[var(--muted)]"}`} strokeWidth={1.75} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-[var(--muted)]">{sub}</div>
      </div>
      {active && <Check className="w-4 h-4 text-[var(--accent)] shrink-0" strokeWidth={2} />}
    </button>
  );
}
