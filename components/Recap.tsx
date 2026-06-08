"use client";
import { useMemo } from "react";
import { fmtDist, fmtDuration } from "@/lib/geo";
import { projectTrack, summarize } from "@/lib/stats";
import type { Destination, Fix } from "@/lib/types";

type Props = {
  destination: Destination;
  track: Fix[];
  startTime: number | null;
  onReset: () => void;
};

const W = 320;
const H = 320;

export default function Recap({ destination, track, startTime, onReset }: Props) {
  const summary = useMemo(() => summarize(track, startTime), [track, startTime]);
  const points = useMemo(() => projectTrack(track, W, H), [track]);

  const pathD = useMemo(() => {
    if (points.length === 0) return "";
    return points
      .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
      .join(" ");
  }, [points]);

  const start = points[0];
  const end = points.at(-1);

  return (
    <div className="flex-1 flex flex-col w-full max-w-md mx-auto px-5 pt-8 pb-10 gap-6">
      <header className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wider text-[var(--muted)]">
          Walk recap
        </span>
        <h1 className="text-2xl font-semibold tracking-tight truncate">
          {destination.name}
        </h1>
      </header>

      <div className="rounded-2xl bg-[#101010] border border-[var(--border)] p-3 flex items-center justify-center">
        {points.length > 1 ? (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto max-w-[320px]"
            aria-label="Walk path"
          >
            <path
              d={pathD}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {start && (
              <circle
                cx={start[0]}
                cy={start[1]}
                r={6}
                fill="none"
                stroke="var(--foreground)"
                strokeWidth={2}
              />
            )}
            {end && (
              <circle cx={end[0]} cy={end[1]} r={6} fill="var(--accent)" />
            )}
          </svg>
        ) : (
          <p className="text-sm text-[var(--muted)] py-12">
            Not enough movement to draw a path.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Walked" value={fmtDist(summary.walked)} />
        <Stat label="Time" value={fmtDuration(summary.durationMs)} />
        <Stat label="As the crow flew" value={fmtDist(summary.straight)} />
        <Stat
          label="Wander factor"
          value={summary.wander > 0 ? `${summary.wander.toFixed(2)}×` : "—"}
        />
        {summary.pace > 0 && (
          <Stat
            label="Pace"
            value={`${summary.pace.toFixed(1)} min/km`}
          />
        )}
      </div>

      <button
        type="button"
        onClick={onReset}
        className="w-full rounded-xl bg-[var(--accent)] text-black font-semibold py-3 active:opacity-80 transition-opacity"
      >
        New walk
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#101010] border border-[var(--border)] px-4 py-3">
      <div className="text-xs uppercase tracking-wider text-[var(--muted)]">
        {label}
      </div>
      <div className="text-lg font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}
