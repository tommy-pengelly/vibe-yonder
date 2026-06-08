"use client";
import { useEffect, useState } from "react";
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

  const summary = summarize(track, startTime, pausedMs);

  return (
    <div className="flex items-baseline justify-center gap-8">
      <Field label="Time" value={fmtDuration(summary.durationMs)} />
      <span className="text-[var(--muted)]/40">·</span>
      <Field label="Distance" value={fmtDist(summary.walked)} />
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
