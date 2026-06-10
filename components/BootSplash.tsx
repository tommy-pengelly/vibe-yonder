"use client";
import { useEffect, useState } from "react";

// Calm boot splash: the spyglass mark + wordmark on the dark field, held for a
// beat then faded once fonts are ready. Lives in AppChrome, which stays mounted
// across client navigations, so it shows once per cold load, never on tab
// switches. Minimal motion: a single gentle fade, nothing pulses.
export default function BootSplash() {
  const [phase, setPhase] = useState<"show" | "fading" | "done">("show");

  useEffect(() => {
    let fadeTimer: number;
    const beginFade = () => {
      setPhase("fading");
      fadeTimer = window.setTimeout(() => setPhase("done"), 480);
    };
    let cancelled = false;
    const maxHold = window.setTimeout(beginFade, 1400);
    const ready =
      typeof document !== "undefined" && "fonts" in document
        ? document.fonts.ready
        : Promise.resolve();
    void ready.then(() => {
      if (cancelled) return;
      window.clearTimeout(maxHold);
      window.setTimeout(beginFade, 300); // a held beat, not a flash
    });
    return () => {
      cancelled = true;
      window.clearTimeout(maxHold);
      window.clearTimeout(fadeTimer);
    };
  }, []);

  if (phase === "done") return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-[var(--background)] transition-opacity duration-500 ${
        phase === "fading" ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/mark.png" alt="" className="w-20 h-auto opacity-95" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/wordmark-light.png"
        alt="Yonderful"
        className="w-44 h-auto"
      />
    </div>
  );
}
