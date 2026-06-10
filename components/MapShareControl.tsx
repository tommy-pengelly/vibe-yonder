"use client";
import { Check, Globe, Lock, Share2 } from "lucide-react";
import { useState } from "react";
import { useAuthUser } from "@/lib/auth";
import { setMapVisibility } from "@/lib/data";
import type { StoredMap } from "@/lib/types";
import AuthModal from "./AuthModal";
import BottomSheet from "./ui/BottomSheet";

type Vis = "private" | "public";

/**
 * Publish a map to the community (or take it private again). Cloud-only,  * gates on sign-in. Publishing shares the *places*, so others can Load or
 * Duplicate them; it never exposes your yonders or your location.
 */
export default function MapShareControl({
  map,
  onChange,
}: {
  map: StoredMap;
  onChange?: (v: Vis) => void;
}) {
  const { user } = useAuthUser();
  const [open, setOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const vis: Vis = map.visibility ?? "private";

  const onOpen = () => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setOpen(true);
  };

  const choose = async (v: Vis) => {
    setBusy(true);
    const ok = await setMapVisibility(map.id, v);
    setBusy(false);
    if (ok) {
      onChange?.(v);
      setOpen(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        className="w-full rounded-full border border-[var(--border)] text-[var(--foreground)] py-2.5 flex items-center justify-center gap-2 hover:border-[var(--accent)] hover:text-[var(--accent)]"
      >
        <Share2 className="w-4 h-4" strokeWidth={1.75} />
        {vis === "public" ? "Shared · Public" : "Share map"}
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Share this map">
        <p className="text-xs text-[var(--muted)] -mt-1 leading-relaxed">
          A public map shows up in Find. Others can Load it to wander your
          places their own way, or Duplicate it to make their own. They never
          see your yonders or your location.
        </p>
        <div className="flex flex-col gap-2">
          <Choice
            icon={Globe}
            label="Public"
            sub="Anyone can discover and wander it"
            active={vis === "public"}
            onClick={() => choose("public")}
            busy={busy}
          />
          <Choice
            icon={Lock}
            label="Private"
            sub="Just you"
            active={vis === "private"}
            onClick={() => choose("private")}
            busy={busy}
          />
        </div>
      </BottomSheet>

      <AuthModal
        open={authOpen}
        reason="Sign in to share your map with the community."
        onClose={() => setAuthOpen(false)}
      />
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
        active
          ? "border-[var(--accent)] bg-[var(--surface-2)]"
          : "border-[var(--border)] hover:border-[var(--muted)]"
      }`}
    >
      <Icon
        className={`w-5 h-5 shrink-0 ${active ? "text-[var(--accent)]" : "text-[var(--muted)]"}`}
        strokeWidth={1.75}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-[var(--muted)]">{sub}</div>
      </div>
      {active && <Check className="w-4 h-4 text-[var(--accent)] shrink-0" strokeWidth={2} />}
    </button>
  );
}
