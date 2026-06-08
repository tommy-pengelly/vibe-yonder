"use client";
import { useEffect, useState } from "react";
import { signInWithMagicLink } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/client";

type Props = {
  open: boolean;
  reason?: string;
  onClose: () => void;
};

export default function AuthModal({ open, reason, onClose }: Props) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (!open) {
      setSending(false);
      setSent(false);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@") || sending) return;
    setSending(true);
    setError(null);
    try {
      await signInWithMagicLink(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send link.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-sm bg-[var(--surface)] border-t sm:border border-[var(--border)] sm:rounded-2xl px-5 pt-6 pb-8 flex flex-col gap-4"
      >
        <div>
          <h2 className="font-display text-2xl tracking-tight">Sign in</h2>
          {reason && (
            <p className="text-sm text-[var(--muted)] mt-1">{reason}</p>
          )}
        </div>

        {!configured ? (
          <p className="text-sm text-[var(--muted)]">
            Auth isn&apos;t configured yet. Set{" "}
            <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
            and{" "}
            <code className="font-mono text-xs">
              NEXT_PUBLIC_SUPABASE_ANON_KEY
            </code>{" "}
            to enable accounts. Until then, your walks stay on this device.
          </p>
        ) : sent ? (
          <p className="text-sm">
            Magic link sent. Check {email} and tap the link to sign in.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-2">
              <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                placeholder="you@example.com"
                className="w-full rounded-xl bg-[var(--surface-2)] border border-[var(--border)] px-4 py-3 text-base outline-none focus:border-[var(--accent)]"
              />
            </label>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={sending || !email.includes("@")}
              className="rounded-xl bg-[var(--accent)] text-black font-semibold py-3 active:opacity-80 disabled:opacity-30"
            >
              {sending ? "Sending…" : "Send magic link"}
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={onClose}
          className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] self-center"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
