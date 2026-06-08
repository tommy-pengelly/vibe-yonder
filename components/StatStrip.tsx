"use client";
import { useEffect, useState } from "react";
import { fmtDist, fmtDuration, fmtPace } from "@/lib/geo";
import { summarize } from "@/lib/stats";
import type { Fix } from "@/lib/types";

type Props = {
  track: Fix[];
  startTime: number | null;
  pausedMs: number;
  paused: boolean;
};

export default function StatStrip({ track, startTime, pausedMs, paused }: Props) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (paused || !startTime) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [paused, startTime]);

  const summary = summarize(track, startTime, pausedMs);
  // tick is used so the duration display refreshes
  void tick;

  return (
    <div className="grid grid-cols-3 gap-px bg-[var(--border)] rounded-xl overflow-hidden">
      <Tile label="Time" value={fmtDuration(summary.durationMs)} />
      <Tile label="Distance" value={fmtDist(summary.walked)} />
      <Tile label="Pace" value={fmtPace(summary.pace)} />
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--surface)] px-3 py-3 flex flex-col items-center">
      <div className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
        {label}
      </div>
      <div className="text-xl font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}
