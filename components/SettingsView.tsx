"use client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useAuthUser, signOut } from "@/lib/auth";
import { useSettings } from "@/lib/settings";

export default function SettingsView() {
  const { settings, update } = useSettings();
  const { user, configured } = useAuthUser();

  return (
    <div className="flex-1 flex flex-col w-full max-w-md mx-auto px-5 pt-8 pb-10 gap-6">
      <header className="flex items-center gap-3">
        <Link
          href="/you"
          aria-label="Back"
          className="size-9 -ml-2 rounded-full flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
        </Link>
        <div>
          <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
            Settings
          </span>
          <h1 className="font-display text-3xl tracking-tight leading-none">
            Your settings
          </h1>
        </div>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
          On the walk
        </h2>
        <Toggle
          label="Hide the numbers"
          description="Keep the dot, the marker, and the place name. Distance, time, and accuracy are hidden while walking. Recap is unaffected."
          checked={settings.hideNumbers}
          onChange={(v) => update({ hideNumbers: v })}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
          Account
        </h2>
        {user ? (
          <>
            <p className="text-sm">
              Signed in as <span className="text-[var(--foreground)]">{user.email ?? "you"}</span>.
            </p>
            <button
              type="button"
              onClick={() => void signOut()}
              className="self-start text-sm text-red-400 hover:opacity-80"
            >
              Sign out
            </button>
          </>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            You&apos;re using Vibe Yonder as a guest. Sign in from{" "}
            <Link href="/you" className="text-[var(--accent)]">
              You
            </Link>{" "}
            to keep your yonders across devices
            {configured ? "." : " (auth not configured in this build)."}
          </p>
        )}
      </section>
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="text-left rounded-2xl border border-[var(--border)] px-4 py-3 flex items-center gap-4 hover:border-[var(--muted)]"
    >
      <div className="flex-1 min-w-0">
        <div className="font-display text-base">{label}</div>
        {description && (
          <div className="text-xs text-[var(--muted)] mt-1 leading-relaxed">
            {description}
          </div>
        )}
      </div>
      <div
        className={`relative shrink-0 w-10 h-6 rounded-full transition-colors ${
          checked ? "bg-[var(--accent)]" : "bg-[var(--border)]"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-[var(--foreground)] transition-transform ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </div>
    </button>
  );
}
