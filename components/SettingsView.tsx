"use client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthUser, signOut } from "@/lib/auth";
import { amAdmin } from "@/lib/data";
import { useSettings } from "@/lib/settings";
import type { Visibility } from "@/lib/types";

export default function SettingsView() {
  const { settings, update } = useSettings();
  const { user, configured } = useAuthUser();
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    void amAdmin().then(setAdmin);
  }, [user]);

  const setHomeZone = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        update({
          privacyZone: { lat: pos.coords.latitude, lon: pos.coords.longitude, radiusM: 200 },
        }),
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

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

      <section className="flex flex-col gap-4">
        <h2 className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
          Privacy
        </h2>
        <div>
          <div className="text-sm font-medium">Default sharing</div>
          <p className="text-xs text-[var(--muted)] mt-1 mb-2 leading-relaxed">
            New yonders start at this visibility. You always choose per yonder on the recap.
          </p>
          <div className="flex gap-2">
            {(["private", "followers", "public"] as Visibility[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => update({ defaultVisibility: v })}
                className={`flex-1 rounded-xl border px-2 py-2 text-xs capitalize transition-colors ${
                  settings.defaultVisibility === v
                    ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--surface)]"
                    : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--muted)]"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-sm font-medium">Home privacy zone</div>
          <p className="text-xs text-[var(--muted)] mt-1 leading-relaxed">
            Shared traces hide a 200&nbsp;m radius around here and trim your start and finish, so
            sharing never reveals where you live.
          </p>
          {settings.privacyZone ? (
            <div className="flex items-center gap-3 mt-2 text-sm">
              <span className="text-[var(--accent)]">Zone set ✓</span>
              <button
                type="button"
                onClick={() => update({ privacyZone: null })}
                className="text-xs text-[var(--muted)] hover:text-red-400"
              >
                Clear
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={setHomeZone}
              className="mt-2 self-start rounded-full border border-[var(--border)] text-sm px-4 py-2 hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              Set to my current location
            </button>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
          Account
        </h2>
        {user?.username && (
          <Link href={`/u/${user.username}`} className="text-sm text-[var(--accent)] hover:opacity-80 self-start">
            View your public profile
          </Link>
        )}
        {admin && (
          <Link href="/admin" className="text-sm text-[var(--accent)] hover:opacity-80 self-start">
            Moderation queue
          </Link>
        )}
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
