"use client";
import { useEffect, useRef, useState } from "react";
import { fmtDist, fmtDuration } from "@/lib/geo";
import { summarize } from "@/lib/stats";
import type { Fix } from "@/lib/types";

type Props = {
  track: Fix[];
  startTime: number | null;
  pausedMs: number;
  paused: boolean;
};

export default function StatStrip({ track, startTime, pausedMs, paused }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (paused || !startTime) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [paused, startTime]);

  const live = summarize(track, startTime, pausedMs);

  // Freeze the clock while paused. GPS fixes keep re-rendering the parent, and
  // `summarize` reads a fresh Date.now() each call, so without this the time
  // would keep climbing during a pause. Capture it at the pause instant.
  const frozenRef = useRef<number | null>(null);
  if (paused) {
    if (frozenRef.current == null) frozenRef.current = live.durationMs;
  } else {
    frozenRef.current = null;
  }
  const durationMs = frozenRef.current ?? live.durationMs;

  return (
    <div className="flex items-baseline justify-center gap-8">
      <Field label="Time" value={fmtDuration(durationMs)} />
      <span className="text-[var(--muted)]/40">·</span>
      <Field label="Distance" value={fmtDist(live.walked)} />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
        {label}
      </div>
      <div className="font-mono text-xl tabular-nums mt-0.5">{value}</div>
    </div>
  );
}
