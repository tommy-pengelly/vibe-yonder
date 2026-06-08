"use client";
import Link from "next/link";
import type { AuthUser, SavedYonder } from "@/lib/types";

type Props = {
  user: AuthUser | null;
  recent: SavedYonder[];
  onStart: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onOpenRecap: (y: SavedYonder) => void;
};

export default function Landing({
  user,
  recent,
  onStart,
  onSignIn,
  onSignOut,
  onOpenRecap,
}: Props) {
  return (
    <div className="flex-1 flex flex-col w-full max-w-md mx-auto px-6 pt-16 pb-12 gap-8">
      <header className="flex flex-col gap-4">
        <h1 className="font-display text-5xl tracking-tight leading-none">
          Vibe
          <br />
          Yonder
        </h1>
        <p className="text-[15px] text-[var(--warm)] leading-snug max-w-xs">
          Pick a place. Wander there — no route, just an arrow and your own two
          feet.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onStart}
          className="w-full rounded-full bg-[var(--accent)] text-black font-semibold py-4 text-base active:opacity-80"
        >
          Start exploring
        </button>
        {user ? (
          <button
            type="button"
            onClick={onSignOut}
            className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] self-center"
          >
            Signed in as {user.email ?? "you"} · Sign out
          </button>
        ) : (
          <button
            type="button"
            onClick={onSignIn}
            className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] self-center"
          >
            Sign in
          </button>
        )}
      </div>

      {recent.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
            Recent yonders
          </h2>
          <ul className="flex flex-col divide-y divide-[var(--border)]">
            {recent.slice(0, 4).map((y) => (
              <li key={y.id}>
                <button
                  type="button"
                  onClick={() => onOpenRecap(y)}
                  className="w-full text-left py-3 flex items-center justify-between gap-3 hover:text-[var(--accent)]"
                >
                  <div className="min-w-0">
                    <div className="font-display text-lg truncate">{y.name}</div>
                    <div className="text-xs text-[var(--muted)] mt-0.5">
                      {new Date(y.endedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      · {(y.walked / 1000).toFixed(2)} km
                    </div>
                  </div>
                  <div className="text-xs font-mono text-[var(--accent)] tabular-nums shrink-0">
                    {y.yondered.toFixed(2)}×
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-auto flex items-center justify-center pt-8">
        <Link
          href="/explain"
          className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          How it works
        </Link>
      </div>
    </div>
  );
}
