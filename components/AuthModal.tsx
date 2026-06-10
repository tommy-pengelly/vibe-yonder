"use client";
import * as Dialog from "@radix-ui/react-dialog";
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
