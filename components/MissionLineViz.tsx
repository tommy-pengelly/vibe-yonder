"use client";
import { MEDAL_BANDS, type LinePoint } from "@/lib/straightline";

// The mission's straight line A→B (horizontal), the medal corridor bands, and
// every attempt's run overlaid in the line's frame. Deviation (y) is heavily
// exaggerated vs distance (x) so the wiggle is legible. A highlighted run
// (a tapped leaderboard row) draws bold amber on top.

const W = 320;
const H = 150;
const PAD = 14;
const MID = H / 2;
const HALF = MID - 12;
const MAX_DEV = 140; // metres mapped to HALF; worse runs clamp to the edge

const xAt = (along: number) => PAD + along * (W - 2 * PAD);
const yAt = (devM: number) => {
  const y = MID - (Math.max(-MAX_DEV, Math.min(MAX_DEV, devM)) / MAX_DEV) * HALF;
  return y;
};

function polyline(path: LinePoint[]): string {
  return path.map(([a, d], i) => `${i === 0 ? "M" : "L"}${xAt(a).toFixed(1)},${yAt(d).toFixed(1)}`).join(" ");
}

export type VizAttempt = { path?: LinePoint[]; isMe: boolean };

export default function MissionLineViz({
  attempts,
  highlight,
}: {
  attempts: VizAttempt[];
  highlight: number | null;
}) {
  const hi = highlight != null ? attempts[highlight] : null;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
      role="img"
      aria-label="Attempts overlaid on the line"
    >
      {/* Medal corridor bands (faint), ± each threshold */}
      {MEDAL_BANDS.map((b) => (
        <g key={b.medal} stroke="var(--border)" strokeDasharray="2 4" strokeWidth={1}>
          <line x1={PAD} y1={yAt(b.half)} x2={W - PAD} y2={yAt(b.half)} />
          <line x1={PAD} y1={yAt(-b.half)} x2={W - PAD} y2={yAt(-b.half)} />
        </g>
      ))}

      {/* The line A→B */}
      <line
        x1={PAD}
        y1={MID}
        x2={W - PAD}
        y2={MID}
        stroke="var(--accent)"
        strokeOpacity={0.5}
        strokeWidth={1.5}
      />
      <circle cx={PAD} cy={MID} r={3} fill="var(--accent)" />
      <circle cx={W - PAD} cy={MID} r={3} fill="var(--accent)" />
      <text x={PAD} y={MID + 16} fontSize={9} fill="var(--muted)" fontFamily="monospace">A</text>
      <text x={W - PAD - 6} y={MID + 16} fontSize={9} fill="var(--muted)" fontFamily="monospace">B</text>

      {/* Every attempt (faint), highlighted one bold on top */}
      {attempts.map((a, i) =>
        !a.path || a.path.length < 2 || i === highlight ? null : (
          <path
            key={i}
            d={polyline(a.path)}
            fill="none"
            stroke={a.isMe ? "var(--warm)" : "var(--muted)"}
            strokeOpacity={a.isMe ? 0.55 : 0.3}
            strokeWidth={1.25}
            strokeLinejoin="round"
          />
        ),
      )}
      {hi?.path && hi.path.length > 1 && (
        <path
          d={polyline(hi.path)}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2.25}
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
