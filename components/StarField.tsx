// A faint, static star map: the constellation language the whole app reads by
// (the splash, the launch home, the walk scope are all the same sky). Static by
// design, no twinkle (CLAUDE.md: minimal motion). [xPct, yPct, radius, opacity].
const STARS: [number, number, number, number][] = [
  [8, 14, 0.7, 0.4], [14, 30, 1, 0.55], [21, 9, 0.7, 0.35], [27, 22, 1.4, 0.75],
  [33, 38, 0.7, 0.3], [40, 14, 0.9, 0.5], [46, 30, 0.7, 0.3], [52, 10, 1.3, 0.7],
  [58, 25, 0.7, 0.35], [64, 16, 0.8, 0.45], [71, 33, 1, 0.55], [78, 12, 1.5, 0.8],
  [85, 26, 0.7, 0.3], [91, 40, 0.8, 0.4], [6, 46, 0.7, 0.3], [17, 58, 0.9, 0.5],
  [12, 74, 0.7, 0.35], [24, 84, 1.2, 0.65], [33, 66, 0.7, 0.3], [41, 80, 0.8, 0.4],
  [50, 92, 0.7, 0.3], [55, 70, 1, 0.55], [62, 86, 0.7, 0.35], [70, 72, 1.3, 0.7],
  [77, 88, 0.7, 0.3], [84, 64, 0.8, 0.45], [92, 80, 0.7, 0.35], [4, 90, 0.7, 0.3],
  [47, 52, 0.6, 0.25], [67, 50, 0.7, 0.3], [30, 50, 0.6, 0.25], [88, 52, 0.6, 0.25],
];

// A few faint lines tracing loose constellations between the brighter stars.
const LINES: [number, number, number, number][] = [
  [27, 22, 40, 14], [40, 14, 52, 10], [52, 10, 64, 16], [64, 16, 78, 12],
  [14, 30, 27, 22], [24, 84, 33, 66], [55, 70, 70, 72], [70, 72, 78, 88],
];

export default function StarField({
  lines = false,
  className = "",
}: {
  lines?: boolean;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
      className={`pointer-events-none ${className}`}
    >
      {lines &&
        LINES.map(([x1, y1, x2, y2], i) => (
          <line
            key={`l${i}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#ededed"
            strokeWidth={0.12}
            opacity={0.16}
          />
        ))}
      {STARS.map(([x, y, r, o], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#ededed" opacity={o} />
      ))}
    </svg>
  );
}
