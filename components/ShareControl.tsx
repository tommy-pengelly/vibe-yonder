"use client";
import { Check, Globe, Lock, Share2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuthUser } from "@/lib/auth";
import { publishYonder, shareStatus, unpublishYonder } from "@/lib/data";
import { useSettings } from "@/lib/settings";
import type { SavedYonder } from "@/lib/types";
import AuthModal from "./AuthModal";

type Vis = "public" | "followers" | null;

/** Self-contained share control for a recap. Publishing writes an obfuscated
 * copy (the precise track never leaves the owner); the home zone is removed and
 * the start/finish trimmed. Gates on sign-in. */
export default function ShareControl({ saved }: { saved: SavedYonder }) {
  const { user } = useAuthUser();
  const { settings } = useSettings();
  const [status, setStatus] = useState<Vis>(null);
  const [open, setOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [caption, setCaption] = useState(saved.caption ?? "");
  const [busy, setBusy] = useState(false);

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

  const label =
    status === "public" ? "Shared · Public" : status === "followers" ? "Shared · Followers" : "Share";

  const onOpen = () => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setOpen(true);
  };

  const choose = async (vis: Vis) => {
    setBusy(true);
    if (vis === null) await unpublishYonder(saved.id);
    else await publishYonder(saved, { visibility: vis, caption, zone: settings.privacyZone });
    setStatus(vis);
    setBusy(false);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        className="rounded-full border border-[var(--border)] text-[var(--foreground)] py-2.5 flex items-center justify-center gap-2 hover:border-[var(--accent)] hover:text-[var(--accent)]"
      >
        <Share2 className="w-4 h-4" strokeWidth={1.75} />
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/50" onClick={() => setOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-[var(--surface)] border-t border-[var(--border)] rounded-t-2xl px-5 pt-5 pb-8 flex flex-col gap-4"
          >
            <div>
              <h2 className="font-display text-xl">Share this yonder</h2>
              <p className="text-xs text-[var(--muted)] mt-1 leading-relaxed">
                You share the places + an obfuscated trace memento, never your route. Your start and
                finish near home stay hidden.
              </p>
            </div>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Say a word about the wander… (optional)"
              rows={2}
              className="w-full resize-none rounded-xl bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]/60"
            />
            <div className="flex flex-col gap-2">
              <Choice icon={Globe} label="Public" sub="Anyone can discover it" active={status === "public"} onClick={() => choose("public")} busy={busy} />
              <Choice icon={Users} label="Followers" sub="Only people who follow you" active={status === "followers"} onClick={() => choose("followers")} busy={busy} />
              <Choice icon={Lock} label="Private" sub="Just you, unshare" active={status === null} onClick={() => choose(null)} busy={busy} />
            </div>
          </div>
        </div>
      )}

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
