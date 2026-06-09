"use client";
import { useEffect } from "react";

/**
 * Error boundary for the content area. It renders inside the root layout, so
 * the bottom nav stays visible while the page shows a recoverable message —
 * instead of a hard "this page couldn't load". The "Reload" does a full
 * navigation, which also recovers from a stale-deployment chunk mismatch.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-5 gap-3 text-center">
      <p className="font-display text-2xl tracking-tight">Something went sideways</p>
      <p className="text-sm text-[var(--muted)] max-w-xs leading-relaxed">
        That page hit a snag. Try again, or head back to the Feed.
      </p>
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-[var(--accent)] text-black text-sm font-semibold px-4 py-2 active:opacity-80"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => {
            window.location.href = "/";
          }}
          className="rounded-full border border-[var(--border)] text-sm px-4 py-2 hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          Reload Feed
        </button>
      </div>
      {error.digest && (
        <p className="text-[10px] text-[var(--muted)] mt-2 font-mono">ref: {error.digest}</p>
      )}
    </div>
  );
}
