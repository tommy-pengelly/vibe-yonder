// Tiny SVG cards that make the app feel alive: a wander's trace shape and a
// map's relative POI scatter. Points are pre-normalised to a 0–100 box (see
// lib/geo `toUnitBox`, or the obfuscated 0–100 mementos from shared content).

export function Trace({
  points,
  height = 150,
  fill = true,
}: {
  points: number[][];
  height?: number;
  fill?: boolean;
}) {
  const d =
    points.length < 2
      ? ""
      : points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  return (
    <div className="recap-mask w-full" style={{ height }}>
      {d ? (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio={fill ? "none" : "xMidYMid meet"}
          className="w-full h-full block"
          aria-hidden="true"
        >
          <path
            d={d}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={fill ? 1.4 : 2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.85}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : null}
    </div>
  );
}

export function DotMap({
  points,
  height = 110,
}: {
  points: number[][];
  height?: number;
}) {
  return (
    <div className="recap-mask w-full" style={{ height }}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="w-full h-full block"
        aria-hidden="true"
      >
        {points.map(([x, y], i) => (
          <g key={i}>
            <circle
              cx={x}
              cy={y}
              r={4.5}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={1}
              opacity={0.35}
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={x}
              cy={y}
              r={1.8}
              fill="var(--accent)"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
