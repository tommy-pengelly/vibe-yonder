"use client";
import Link from "next/link";
import { useMemo } from "react";
import { fmtDist, fmtDuration, fmtPace } from "@/lib/geo";
import { projectTrack, summarize } from "@/lib/stats";
import type { Destination, Fix } from "@/lib/types";

type Props = {
  destination: Destination;
  track: Fix[];
  startTime: number | null;
  pausedMs: number;
  endTime: number | null;
  onReset: () => void;
};

const W = 340;
const H = 340;

export default function Recap({
  destination,
  track,
  startTime,
  pausedMs,
  endTime,
  onReset,
}: Props) {
  const summary = useMemo(
    () => summarize(track, startTime, pausedMs, endTime ?? Date.now()),
    [track, startTime, pausedMs, endTime],
  );
  const points = useMemo(() => projectTrack(track, W, H), [track]);

  const pathD = useMemo(() => {
    if (points.length === 0) return "";
    return points
      .map(
        ([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`,
      )
      .join(" ");
  }, [points]);

  const start = points[0];
  const end = points.at(-1);
  const yonderedStr = `${summary.yondered.toFixed(2)}×`;
  const yonderedHero =
    summary.yondered >= 2
      ? `You yondered ${summary.yondered.toFixed(summary.yondered >= 10 ? 0 : 1)}×.`
      : summary.yondered > 1.1
        ? `You took the scenic way.`
        : summary.yondered > 0
          ? `Straight as an arrow.`
          : `Nice walk.`;

  return (
    <div className="flex-1 flex flex-col w-full max-w-md mx-auto px-5 pt-8 pb-10 gap-6">
      <header className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
          Walk recap
        </span>
        <h1 className="text-2xl font-semibold tracking-tight truncate">
          {destination.name}
        </h1>
      </header>

      <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-3 flex items-center justify-center">
        {points.length > 1 ? (
          <div className="recap-trace w-full flex items-center justify-center">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="w-full h-auto max-w-[340px]"
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
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)] py-12">
            Not enough movement to draw a path.
          </p>
        )}
      </div>

      <p className="text-2xl font-semibold tracking-tight text-center">
        {yonderedHero}
      </p>

      <div className="rounded-2xl bg-[var(--accent)] text-black px-4 py-4 flex flex-col items-center">
        <div className="text-[10px] uppercase tracking-widest opacity-75">
          Yondered
        </div>
        <div className="text-4xl font-bold tabular-nums mt-1">
          {yonderedStr}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Walked" value={fmtDist(summary.walked)} />
        <Stat label="Time" value={fmtDuration(summary.durationMs)} />
        <Stat label="Direct" value={fmtDist(summary.direct)} />
        <Stat label="Pace" value={fmtPace(summary.pace)} />
      </div>

      <div className="flex items-center justify-center">
        <Link
          href="/explain"
          className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] underline-offset-2 hover:underline"
        >
          What do these stats mean?
        </Link>
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
    <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] px-4 py-3">
      <div className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
        {label}
      </div>
      <div className="text-lg font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}
