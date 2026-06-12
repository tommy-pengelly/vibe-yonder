"use client";
import { Check, Telescope } from "lucide-react";
import { useState } from "react";
import { useAuthUser } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase/client";
import BottomSheet from "@/components/ui/BottomSheet";
import AuthModal from "./AuthModal";

// The Yonder+ upsell, shown only when someone reaches for a premium extra.
// The core wander is never behind this. Checkout is a stub until Stripe keys +
// the webhook are wired (see supabase/functions/stripe-webhook).
const PERKS = [
  "The discovery radar, nearby wonders surfaced as you go",
  "Game modes, straight-line missions, clue hunts, tours",
  "Unlimited maps, and collaborate on them",
  "Ways reports, full history & your exploration heatmap",
];

export default function YonderPlusSheet({
  open,
  onClose,
  reason,
}: {
  open: boolean;
  onClose: () => void;
  reason?: string;
}) {
  const { user } = useAuthUser();
  const [authOpen, setAuthOpen] = useState(false);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const startCheckout = async () => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    setErr(null);
    const { data, error } = await sb.functions.invoke("create-checkout");
    setBusy(false);
    const url = (data as { url?: string } | null)?.url;
    if (url) {
      window.location.href = url;
    } else {
      // Until Stripe is wired (function deployed + secrets set) this just fails.
      setErr("Checkout isn't available yet.");
      console.warn("create-checkout:", error?.message);
    }
  };

  return (
    <>
      <BottomSheet open={open} onClose={onClose} title="Yonder+">
        <div className="flex items-center gap-2 -mt-1">
          <Telescope className="w-5 h-5 text-[var(--accent)]" strokeWidth={1.75} />
          <p className="text-sm text-[var(--warm)]">
            {reason ?? "Go further. The wander itself is always free, Yonder+ adds the extras."}
          </p>
        </div>
        <ul className="flex flex-col gap-2.5 my-1">
          {PERKS.map((p) => (
            <li key={p} className="flex items-start gap-2.5 text-sm">
              <Check className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" strokeWidth={2} />
              <span>{p}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => void startCheckout()}
          disabled={busy}
          className="rounded-full bg-[var(--accent)] text-black font-semibold py-3 active:opacity-80 disabled:opacity-40"
        >
          {busy ? "Opening…" : "Get Yonder+ · £3/mo"}
        </button>
        {err && <p className="text-[11px] text-red-400 text-center">{err}</p>}
        <p className="text-[11px] text-[var(--muted)] text-center">
          7-day free trial · the core wander stays free, always.
        </p>
      </BottomSheet>
      <AuthModal
        open={authOpen}
        reason="Sign in to start your Yonder+ subscription."
        onClose={() => setAuthOpen(false)}
      />
    </>
  );
}
