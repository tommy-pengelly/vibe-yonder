// Tiny SVG cards that make the app feel alive: a wander's trace shape and a
// map's relative POI scatter. Points are pre-normalised to a 0–100 box (see
// lib/geo `toUnitBox`, or the obfuscated 0–100 mementos from shared content).

// A four-point twinkle (a place you saw), drawn instead of a plain dot so the
// recap reads as a sky. Concave sides give the sparkle; a faint halo softens it.
// cx/cy/r are in the same units as the surrounding viewBox.
export function Twinkle({
  cx,
  cy,
  r = 3.2,
  color = "var(--foreground)",
  opacity = 0.85,
}: {
  cx: number;
  cy: number;
  r?: number;
  color?: string;
  opacity?: number;
}) {
  const ir = r * 0.34; // inner radius → pointy arms
  const pts: string[] = [];
  for (let i = 0; i < 8; i++) {
    const ang = (Math.PI / 4) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : ir;
    pts.push(`${(cx + rad * Math.cos(ang)).toFixed(2)},${(cy + rad * Math.sin(ang)).toFixed(2)}`);
  }
  return (
    <g opacity={opacity}>
      <circle cx={cx} cy={cy} r={r * 1.5} fill={color} opacity={0.12} />
      <polygon points={pts.join(" ")} fill={color} />
    </g>
  );
}

// A small scale caption (e.g. "≈ 1.2 km across") in the corner of a card.
function ScaleTag({ label }: { label?: string }) {
  if (!label) return null;
  return (
    <span className="absolute bottom-1.5 right-2 text-[9px] font-mono uppercase tracking-wide text-[var(--muted)]">
      {label}
    </span>
  );
}

export function Trace({
  points,
  height = 150,
  fill = false,
  scaleLabel,
  stars,
}: {
  points: number[][];
  height?: number;
  fill?: boolean;
  scaleLabel?: string;
  /** Places seen, in the same 0–100 frame as `points`, drawn as twinkles. */
  stars?: number[][];
}) {
  const d =
    points.length < 2
      ? ""
      : points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  return (
    <div className="recap-mask w-full relative" style={{ height }}>
      {d ? (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio={fill ? "none" : "xMidYMid meet"}
          className="w-full h-full block"
          aria-hidden="true"
        >
          {stars?.map(([x, y], i) => (
            <Twinkle key={i} cx={x} cy={y} r={2.6} />
          ))}
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
      <ScaleTag label={scaleLabel} />
    </div>
  );
}

// Several traces overlaid in a shared box, every way you've moved around a
// place/area. Pre-normalise with toUnitBoxMulti so they line up.
export function Traces({
  tracks,
  height = 170,
  scaleLabel,
}: {
  tracks: number[][][];
  height?: number;
  scaleLabel?: string;
}) {
  return (
    <div className="recap-mask w-full relative" style={{ height }}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full block"
        aria-hidden="true"
      >
        {tracks.map((pts, i) =>
          pts.length < 2 ? null : (
            <path
              key={i}
              d={pts
                .map((p, j) => `${j === 0 ? "M" : "L"}${p[0]},${p[1]}`)
                .join(" ")}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.35}
              vectorEffect="non-scaling-stroke"
            />
          ),
        )}
      </svg>
      <ScaleTag label={scaleLabel} />
    </div>
  );
}

export function DotMap({
  points,
  height = 110,
  scaleLabel,
}: {
  points: number[][];
  height?: number;
  scaleLabel?: string;
}) {
  return (
    <div className="recap-mask w-full relative" style={{ height }}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
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
      <ScaleTag label={scaleLabel} />
    </div>
  );
}
