"use client";
import { type MouseEvent as ReactMouseEvent, useEffect, useRef } from "react";
import {
  FADE_START,
  RIM_FRACTION,
  SCALE_LEVELS_M,
} from "@/lib/constants";
import {
  bearing,
  fmtDist,
  haversine,
  makeAngleSmoother,
  toRad,
} from "@/lib/geo";
import { categoryByKey } from "@/lib/nearby";
import type { ScopeCandidate } from "@/hooks/useDiscovery";
import type { Fix, LatLon, Target } from "@/lib/types";

type Props = {
  position: Fix | null;
  heading: number | null;
  track: Fix[];
  targets: Target[];
  /** Index of the bold (focused) target in `targets`, or null. */
  activeIndex: number | null;
  mpp: number;
  hideNumbers: boolean;
  /** When set, tapping a target's marker focuses it (Collection mode). */
  onPickTarget?: (id: string) => void;
  /** Ambient discovery: faint mystery dots that resolve on approach. */
  candidates?: ScopeCandidate[];
  /** Tapping a candidate dot opens its detail/reveal. */
  onPickCandidate?: (id: string) => void;
  /** Straight-line mode: A (start). The line runs A→targets[0]; faint corridor. */
  lineOrigin?: LatLon | null;
  /** Minimal: hide the scale key (e.g. navigating to a mission start). */
  minimal?: boolean;
};

const ACCENT = "#f5a623";
const FG = "#ededed";
const MUTED_TEXT = "rgba(173, 168, 157, 0.55)";
// Discovery stars are cool (white), reserved amber is the path. A match to your
// lens tints violet. RGB triplets so opacity can encode notability.
const STAR_RGB = "237, 237, 237";
const LENS_RGB = "167, 139, 250";

export default function Scope({
  position,
  heading,
  track,
  targets,
  activeIndex,
  mpp,
  hideNumbers,
  onPickTarget,
  candidates = [],
  onPickCandidate,
  lineOrigin,
  minimal = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotSmoother = useRef(makeAngleSmoother());
  // Each drawn target's marker position, for tap hit-testing.
  const hitsRef = useRef<{ id: string; x: number; y: number }[]>([]);
  // Drawn candidate-dot positions, hit-tested separately so a tap routes to the
  // reveal rather than to target focus.
  const candHitsRef = useRef<{ id: string; x: number; y: number }[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // The dot is fixed dead-centre; the scope never pans.
    const cx = w / 2;
    const cy = h * 0.45;

    const rimR = Math.min(w, h) * RIM_FRACTION;
    const rotDeg = heading != null ? rotSmoother.current(-heading) : 0;
    const rot = (rotDeg * Math.PI) / 180;
    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);
    // Map a true-north-up projected point to its heading-up screen position,
    // matching the rotation applied to the trail. Used so dots and their labels
    // share one coordinate space and never drift apart.
    const applyRot = (px: number, py: number) => {
      const dx = px - cx;
      const dy = py - cy;
      return {
        x: cx + dx * cosR - dy * sinR,
        y: cy + dx * sinR + dy * cosR,
      };
    };

    // --- Straight-line corridor: the line A→B + faint medal bands, drawn
    // under the trail. Bands are offset perpendicular in screen pixels
    // (d metres = d / mpp px), so no need to reproject offset world points.
    if (lineOrigin && position && targets[0]) {
      const pa = projectAt(lineOrigin, position, cx, cy, mpp);
      const pb = projectAt(targets[0], position, cx, cy, mpp);
      const a2 = applyRot(pa.x, pa.y);
      const b2 = applyRot(pb.x, pb.y);
      let dx = b2.x - a2.x;
      let dy = b2.y - a2.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      const px = -dy;
      const py = dx; // perpendicular
      const BIG = 2 * Math.max(w, h);
      const drawLine = (off: number, color: string, dash: number[] | null) => {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.setLineDash(dash ?? []);
        const ox = px * off;
        const oy = py * off;
        ctx.beginPath();
        ctx.moveTo(a2.x + ox - dx * BIG, a2.y + oy - dy * BIG);
        ctx.lineTo(a2.x + ox + dx * BIG, a2.y + oy + dy * BIG);
        ctx.stroke();
        ctx.restore();
      };
      const bands: [number, number][] = [
        [12.5, 0.18],
        [25, 0.13],
        [50, 0.09],
        [100, 0.06],
      ];
      for (const [half, op] of bands) {
        const offPx = half / mpp;
        drawLine(offPx, `rgba(237, 237, 237, ${op})`, [4, 5]);
        drawLine(-offPx, `rgba(237, 237, 237, ${op})`, [4, 5]);
      }
      drawLine(0, "rgba(245, 166, 35, 0.45)", null);
    }

    // --- World space: only the trail rotates with the scope ---
    ctx.save();
    if (rotDeg !== 0) {
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.translate(-cx, -cy);
    }
    if (position && track.length > 1) {
      // Your course: one warm, dotted line threading the star sky (round caps +
      // a tight dash read as dots). setLineDash is restored by the surrounding
      // save/restore.
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 3;
      ctx.setLineDash([0.1, 8]);
      ctx.strokeStyle = "rgba(245, 166, 35, 0.6)";
      ctx.beginPath();
      const p0 = projectAt(track[0], position, cx, cy, mpp);
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < track.length; i++) {
        const b = projectAt(track[i], position, cx, cy, mpp);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
    }
    ctx.restore();

    // --- Screen space (drawn upright; rotation applied per-point) ---

    type TargetState = {
      target: Target;
      isActive: boolean;
      dist: number;
      brg: number;
      inCircle: boolean;
      dotOpacity: number; // 0..1 if in-circle
      screen: { x: number; y: number }; // heading-up screen position
    };

    const states: TargetState[] = [];
    if (position) {
      targets.forEach((t, i) => {
        if (t.visited) return;
        const dist = haversine(position.lat, position.lon, t.lat, t.lon);
        const brg = bearing(position.lat, position.lon, t.lat, t.lon);
        const raw = projectAt(t, position, cx, cy, mpp);
        const r = Math.hypot(raw.x - cx, raw.y - cy);
        const inCircle = r < rimR;
        let dotOpacity = 1;
        if (inCircle) {
          const ratio = r / rimR;
          dotOpacity =
            ratio < FADE_START
              ? 1
              : 1 - (ratio - FADE_START) / (1 - FADE_START);
        }
        states.push({
          target: t,
          isActive: i === activeIndex,
          dist,
          brg,
          inCircle,
          dotOpacity,
          screen: applyRot(raw.x, raw.y),
        });
      });
    }

    // A label (distance + name) for the active target, placed beside whichever
    // form it took, the dot when in-circle, the chevron when at the rim.
    let activeLabel: {
      x: number;
      y: number;
      dist: number;
      name: string;
    } | null = null;

    hitsRef.current = [];

    // In-circle targets: a dot at the true (heading-up) position.
    for (const s of states) {
      if (!s.inCircle) continue;
      const opacity = s.isActive ? s.dotOpacity : s.dotOpacity * 0.45;
      drawDestDot(ctx, s.screen.x, s.screen.y, opacity, s.isActive);
      hitsRef.current.push({ id: s.target.id, x: s.screen.x, y: s.screen.y });
      if (s.isActive) {
        activeLabel = {
          x: s.screen.x,
          y: s.screen.y + 22,
          dist: s.dist,
          name: s.target.name,
        };
      } else if (!hideNumbers && s.dotOpacity > 0.05) {
        // Ghost gets a small distance so you can tell how far each place is.
        ctx.fillStyle = `rgba(173, 168, 157, ${(0.5 * s.dotOpacity).toFixed(2)})`;
        ctx.font = "500 10px var(--font-mono), ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(fmtDist(s.dist), s.screen.x, s.screen.y + 15);
      }
    }

    // The constellation: discovery stars at their true positions, on-canvas only
    // ("in focus", zoom out to reach further). Brightness + size encode
    // notability; hue is cool (a lens-match tints violet); never amber, never a
    // rim chevron, discovery never points. Drawn under the user dot.
    candHitsRef.current = [];
    if (position) {
      for (const c of candidates) {
        const raw = projectAt(c, position, cx, cy, mpp);
        const r = Math.hypot(raw.x - cx, raw.y - cy);
        if (r >= rimR) continue;
        const { x, y } = applyRot(raw.x, raw.y);
        drawCandidate(ctx, x, y, c);
        candHitsRef.current.push({ id: c.id, x, y });
      }
    }

    // The dot: an upward arrowhead (you, heading-up). Dimmer while acquiring.
    {
      const o = position ? 1 : 0.45;
      ctx.fillStyle = `rgba(237, 237, 237, ${o})`;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 10);
      ctx.lineTo(cx + 8, cy + 8);
      ctx.lineTo(cx, cy + 3);
      ctx.lineTo(cx - 8, cy + 8);
      ctx.closePath();
      ctx.fill();
    }

    // Out-of-circle targets: a chevron on a fixed invisible radius.
    const chevronR = Math.min(w, h) * 0.36;
    const labelR = chevronR + 28;
    for (const s of states) {
      if (s.inCircle) continue;
      const relBrg = heading != null ? s.brg - heading : s.brg;
      const a = (relBrg * Math.PI) / 180;
      const tx = cx + chevronR * Math.sin(a);
      const ty = cy - chevronR * Math.cos(a);

      const opacity = s.isActive ? 1 : 0.32;
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(a);
      ctx.globalAlpha = opacity;
      ctx.fillStyle = ACCENT;
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(9, 7);
      ctx.lineTo(0, 3);
      ctx.lineTo(-9, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      hitsRef.current.push({ id: s.target.id, x: tx, y: ty });
      const lx = cx + labelR * Math.sin(a);
      const ly = cy - labelR * Math.cos(a);
      if (s.isActive) {
        activeLabel = { x: lx, y: ly, dist: s.dist, name: s.target.name };
      } else if (!hideNumbers) {
        // Ghost gets a small distance beside its rim chevron.
        ctx.fillStyle = MUTED_TEXT;
        ctx.font = "500 10px var(--font-mono), ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(fmtDist(s.dist), lx, ly);
      }
    }

    if (activeLabel) {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (!hideNumbers) {
        ctx.fillStyle = FG;
        ctx.font = "600 18px var(--font-display), Georgia, serif";
        ctx.fillText(fmtDist(activeLabel.dist), activeLabel.x, activeLabel.y);
        ctx.fillStyle = MUTED_TEXT;
        ctx.font = "500 11px var(--font-sans), system-ui, sans-serif";
        ctx.fillText(
          truncate(activeLabel.name, 24),
          activeLabel.x,
          activeLabel.y + 16,
        );
      } else {
        ctx.fillStyle = FG;
        ctx.font = "500 13px var(--font-sans), system-ui, sans-serif";
        ctx.fillText(
          truncate(activeLabel.name, 24),
          activeLabel.x,
          activeLabel.y,
        );
      }
    }

    // Subtle scale key, bottom-right. Snaps to a round metres value matching
    // the current `mpp`. Hidden in minimal mode (e.g. heading to a start).
    if (minimal) return;
    const halfRadiusPx = rimR;
    const impliedMetres = halfRadiusPx * mpp;
    const snapMetres = nearestScaleLevel(impliedMetres);
    const keyPx = snapMetres / mpp;
    const sxRight = w - 18;
    const syBaseline = h - 24;
    // A legible scale key (not rings): a clear bar with end ticks + a bold
    // distance, bright enough to read at a glance. Still bottom-right, still a
    // key, never drawn on the resting void.
    const scaleLine = "rgba(237, 237, 237, 0.6)";
    ctx.strokeStyle = scaleLine;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(sxRight - keyPx, syBaseline);
    ctx.lineTo(sxRight, syBaseline);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sxRight - keyPx, syBaseline - 4);
    ctx.lineTo(sxRight - keyPx, syBaseline + 4);
    ctx.moveTo(sxRight, syBaseline - 4);
    ctx.lineTo(sxRight, syBaseline + 4);
    ctx.stroke();
    ctx.fillStyle = "rgba(237, 237, 237, 0.88)";
    ctx.font = "600 13px var(--font-mono), ui-monospace, monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(formatScale(snapMetres), sxRight, syBaseline - 8);
  }, [position, heading, track, targets, activeIndex, mpp, hideNumbers, candidates, lineOrigin, minimal]);

  const handleClick = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const nearest = (hits: { id: string; x: number; y: number }[]) => {
      let best: string | null = null;
      let bestD = 44; // tap slop in px
      for (const hit of hits) {
        const d = Math.hypot(hit.x - x, hit.y - y);
        if (d < bestD) {
          bestD = d;
          best = hit.id;
        }
      }
      return best;
    };
    // A candidate dot under the finger wins (it's the discovery action); fall
    // back to focusing a destination.
    const cand = onPickCandidate ? nearest(candHitsRef.current) : null;
    if (cand) {
      onPickCandidate!(cand);
      return;
    }
    const target = onPickTarget ? nearest(hitsRef.current) : null;
    if (target) onPickTarget!(target);
  };

  return (
    <div className="scope-wrap">
      <canvas ref={canvasRef} aria-label="Yonder scope" onClick={handleClick} />
    </div>
  );
}

function drawDestDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  opacity: number,
  isActive: boolean,
) {
  if (opacity <= 0) return;
  const dotRadius = isActive ? 6 : 4;
  ctx.fillStyle = `rgba(245, 166, 35, ${opacity.toFixed(2)})`;
  ctx.beginPath();
  ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
  ctx.fill();
}

function drawCandidate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  c: ScopeCandidate,
) {
  // Brightness + size grade by notability: a bright, big star is notable (many
  // sitelinks); a faint, small one is an obscure curio, there to be stumbled on.
  const n = Math.max(0, Math.min(1, c.notability));
  const op = 0.28 + 0.62 * n;
  const r = 2.2 + 3.3 * n;
  const rgb = c.matchesLens ? LENS_RGB : STAR_RGB;

  // Notable stars get a faint halo, the on-scope echo of the sheet's "✦ Noted".
  if (c.tier === "notable") {
    ctx.strokeStyle = `rgba(${rgb}, ${(op * 0.5).toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, r + 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = `rgba(${rgb}, ${op.toFixed(2)})`;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // Only the brighter stars carry a name, so the void stays a calm sky.
  if (c.name && n >= 0.6) {
    const emoji = c.category ? categoryByKey(c.category)?.emoji : undefined;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (emoji) {
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillText(emoji, x, y - r - 9);
    }
    ctx.fillStyle = `rgba(${rgb}, ${Math.min(0.8, op).toFixed(2)})`;
    ctx.font = "500 11px var(--font-sans), system-ui, sans-serif";
    ctx.fillText(truncate(c.name, 18), x, y + r + 10);
  }
}

function projectAt(
  p: LatLon,
  me: LatLon,
  cx: number,
  cy: number,
  mpp: number,
) {
  const kx = Math.cos(toRad(me.lat));
  const east = (p.lon - me.lon) * kx * 111320;
  const north = (p.lat - me.lat) * 110540;
  return { x: cx + east / mpp, y: cy - north / mpp };
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function nearestScaleLevel(metres: number): number {
  let best = SCALE_LEVELS_M[0];
  let bestRatio = Math.abs(Math.log(best / metres));
  for (const lvl of SCALE_LEVELS_M) {
    const r = Math.abs(Math.log(lvl / metres));
    if (r < bestRatio) {
      best = lvl;
      bestRatio = r;
    }
  }
  return best;
}

function formatScale(metres: number) {
  return metres < 1000 ? `${metres} m` : `${metres / 1000} km`;
}
