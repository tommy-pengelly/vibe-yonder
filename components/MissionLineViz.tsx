"use client";
import { MEDAL_BANDS, type LinePoint } from "@/lib/straightline";

// The mission's straight line A→B (horizontal), the medal corridor bands, and
// every attempt's run overlaid in the line's frame. Deviation (y) is heavily
// exaggerated vs distance (x) so the wiggle is legible. A highlighted run
// (a tapped leaderboard row) draws bold amber on top; an optional `compare`
// run draws dashed warm-grey beneath it (you-vs-the-leader).

const W = 320;
const PAD = 14;
const MAX_DEV = 140; // metres mapped to the half-height; worse runs clamp

export type VizAttempt = { path?: LinePoint[]; isMe: boolean };

export default function MissionLineViz({
  attempts,
  highlight,
  compare = null,
  height = 150,
}: {
  attempts: VizAttempt[];
  highlight: number | null;
  compare?: number | null;
  height?: number;
}) {
  const mid = height / 2;
  const half = mid - 12;
  const xAt = (along: number) => PAD + along * (W - 2 * PAD);
  const yAt = (devM: number) =>
    mid - (Math.max(-MAX_DEV, Math.min(MAX_DEV, devM)) / MAX_DEV) * half;
  const line = (path: LinePoint[]) =>
    path.map(([a, d], i) => `${i === 0 ? "M" : "L"}${xAt(a).toFixed(1)},${yAt(d).toFixed(1)}`).join(" ");

  const hi = highlight != null ? attempts[highlight] : null;
  const cmp = compare != null ? attempts[compare] : null;

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
      role="img"
      aria-label="The line, with attempts overlaid"
    >
      {MEDAL_BANDS.map((b) => (
        <g key={b.medal} stroke="var(--border)" strokeDasharray="2 4" strokeWidth={1}>
          <line x1={PAD} y1={yAt(b.half)} x2={W - PAD} y2={yAt(b.half)} />
          <line x1={PAD} y1={yAt(-b.half)} x2={W - PAD} y2={yAt(-b.half)} />
        </g>
      ))}

      <line
        x1={PAD}
        y1={mid}
        x2={W - PAD}
        y2={mid}
        stroke="var(--accent)"
        strokeOpacity={0.5}
        strokeWidth={1.5}
      />
      <circle cx={PAD} cy={mid} r={3} fill="var(--accent)" />
      <circle cx={W - PAD} cy={mid} r={3} fill="var(--accent)" />
      <text x={PAD} y={mid + 16} fontSize={9} fill="var(--muted)" fontFamily="monospace">A</text>
      <text x={W - PAD - 6} y={mid + 16} fontSize={9} fill="var(--muted)" fontFamily="monospace">B</text>

      {attempts.map((a, i) =>
        !a.path || a.path.length < 2 || i === highlight || i === compare ? null : (
          <path
            key={i}
            d={line(a.path)}
            fill="none"
            stroke={a.isMe ? "var(--warm)" : "var(--muted)"}
            strokeOpacity={a.isMe ? 0.55 : 0.3}
            strokeWidth={1.25}
            strokeLinejoin="round"
          />
        ),
      )}
      {cmp?.path && cmp.path.length > 1 && (
        <path
          d={line(cmp.path)}
          fill="none"
          stroke="var(--warm)"
          strokeWidth={1.75}
          strokeDasharray="4 3"
          strokeLinejoin="round"
        />
      )}
      {hi?.path && hi.path.length > 1 && (
        <path
          d={line(hi.path)}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2.25}
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
