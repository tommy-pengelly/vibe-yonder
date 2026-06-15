"use client";
import { useEffect, useState } from "react";

// A fixed, faint scatter of stars behind the mark, the constellation language
// the whole app reads by. Static (no twinkle, brand: minimal motion), a couple
// brighter to echo notability. [xPct, yPct, radius, opacity].
const STARS: [number, number, number, number][] = [
  [12, 18, 1, 0.5], [22, 40, 0.7, 0.35], [31, 12, 1.4, 0.7], [44, 28, 0.7, 0.3],
  [58, 16, 1, 0.5], [70, 33, 0.8, 0.4], [83, 20, 1.6, 0.75], [90, 44, 0.7, 0.3],
  [16, 62, 0.8, 0.4], [27, 78, 1.2, 0.6], [38, 88, 0.7, 0.3], [50, 70, 0.9, 0.45],
  [63, 84, 0.7, 0.3], [74, 66, 1.3, 0.65], [86, 80, 0.8, 0.4], [8, 88, 0.7, 0.3],
  [48, 50, 0.6, 0.25], [66, 54, 0.7, 0.3], [20, 30, 0.6, 0.25], [78, 12, 0.7, 0.3],
];

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
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
        aria-hidden
      >
        {STARS.map(([x, y, r, o], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="#ededed" opacity={o} />
        ))}
      </svg>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/mark.png" alt="" className="relative w-20 h-auto opacity-95" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/wordmark-light.png"
        alt="Yonderful"
        className="relative w-44 h-auto"
      />
    </div>
  );
}
