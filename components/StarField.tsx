// A faint, static star map: the constellation language the whole app reads by
// (the splash, the launch home, the walk scope are all the same sky). Static by
// design, no twinkle (CLAUDE.md: minimal motion).
//
// Positions are percentages and radii are fixed PIXELS (no viewBox), so stars
// stay small and perfectly round at any aspect ratio. (A 0-100 viewBox with
// preserveAspectRatio="none" smears them into ovals on wide screens.)
// [xPct, yPct, radiusPx, opacity].
const STARS: [number, number, number, number][] = [
  [8, 14, 1, 0.4], [14, 30, 1.4, 0.55], [21, 9, 1, 0.35], [27, 22, 1.8, 0.7],
  [33, 38, 1, 0.3], [40, 14, 1.3, 0.5], [46, 30, 1, 0.3], [52, 10, 1.8, 0.65],
  [58, 25, 1, 0.35], [64, 16, 1.2, 0.45], [71, 33, 1.4, 0.5], [78, 12, 2, 0.75],
  [85, 26, 1, 0.3], [91, 40, 1.2, 0.4], [6, 46, 1, 0.3], [17, 58, 1.3, 0.5],
  [12, 74, 1, 0.35], [24, 84, 1.6, 0.6], [33, 66, 1, 0.3], [41, 80, 1.2, 0.4],
  [50, 92, 1, 0.3], [55, 70, 1.4, 0.5], [62, 86, 1, 0.35], [70, 72, 1.7, 0.65],
  [77, 88, 1, 0.3], [84, 64, 1.2, 0.45], [92, 80, 1, 0.35], [4, 90, 1, 0.3],
  [47, 52, 0.9, 0.25], [67, 50, 1, 0.3], [30, 50, 0.9, 0.25], [88, 52, 0.9, 0.25],
];

// A few faint lines tracing loose constellations between brighter stars.
const LINES: [number, number, number, number][] = [
  [27, 22, 40, 14], [40, 14, 52, 10], [52, 10, 64, 16], [64, 16, 78, 12],
  [14, 30, 27, 22], [24, 84, 33, 66], [55, 70, 70, 72], [70, 72, 78, 88],
];

const pct = (n: number) => `${n}%`;

export default function StarField({
  lines = false,
  className = "",
}: {
  lines?: boolean;
  className?: string;
}) {
  return (
    <svg aria-hidden className={`pointer-events-none ${className}`}>
      {lines &&
        LINES.map(([x1, y1, x2, y2], i) => (
          <line
            key={`l${i}`}
            x1={pct(x1)}
            y1={pct(y1)}
            x2={pct(x2)}
            y2={pct(y2)}
            stroke="#ededed"
            strokeWidth={1}
            opacity={0.12}
          />
        ))}
      {STARS.map(([x, y, r, o], i) => (
        <circle key={i} cx={pct(x)} cy={pct(y)} r={r} fill="#ededed" opacity={o} />
      ))}
    </svg>
  );
}
