"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { signInWithMagicLink, verifyEmailOtp } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/client";

type Props = {
  open: boolean;
  reason?: string;
  onClose: () => void;
};

export default function AuthModal({ open, reason, onClose }: Props) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (!open) {
      setSending(false);
      setVerifying(false);
      setSent(false);
      setError(null);
      setCode("");
    }
  }, [open]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@") || sending) return;
    setSending(true);
    setError(null);
    try {
      await signInWithMagicLink(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the code.");
    } finally {
      setSending(false);
    }
  };

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length < 6 || verifying) return;
    setVerifying(true);
    setError(null);
    try {
      await verifyEmailOtp(email.trim(), code);
      onClose(); // signed in; auth state updates via onAuthStateChange
    } catch {
      setError("That code didn't work. Check it, or send a new one.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed z-50 left-1/2 -translate-x-1/2 bottom-0 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 w-full sm:max-w-sm bg-[var(--surface)] border-t sm:border border-[var(--border)] sm:rounded-2xl px-5 pt-6 pb-8 flex flex-col gap-4 outline-none">
          <div>
            <Dialog.Title className="font-display text-2xl tracking-tight">
              Sign in
            </Dialog.Title>
            <Dialog.Description
              className={reason ? "text-sm text-[var(--muted)] mt-1" : "sr-only"}
            >
              {reason ?? "Sign in to Yonderful."}
            </Dialog.Description>
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
            <form onSubmit={onVerify} className="flex flex-col gap-3">
              <p className="text-sm text-[var(--muted)]">
                We sent a code to {email}. Enter it below (or tap the link in the
                email).
              </p>
              <label className="flex flex-col gap-2">
                <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
                  6-digit code
                </span>
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  autoFocus
                  placeholder="123456"
                  className="w-full rounded-xl bg-[var(--surface-2)] border border-[var(--border)] px-4 py-3 text-2xl tracking-[0.4em] tabular-nums text-center outline-none focus:border-[var(--accent)]"
                />
              </label>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={verifying || code.length < 6}
                className="rounded-xl bg-[var(--accent)] text-black font-semibold py-3 active:opacity-80 disabled:opacity-30"
              >
                {verifying ? "Verifying…" : "Verify & sign in"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setCode("");
                  setError(null);
                }}
                className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] self-center"
              >
                Use a different email
              </button>
            </form>
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
                {sending ? "Sending…" : "Email me a code"}
              </button>
            </form>
          )}

          <Dialog.Close asChild>
            <button
              type="button"
              className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] self-center"
            >
              Cancel
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
