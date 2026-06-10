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
};

const ACCENT = "#f5a623";
const FG = "#ededed";
const MUTED_TEXT = "rgba(173, 168, 157, 0.55)";

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

    // --- World space: only the trail rotates with the scope ---
    ctx.save();
    if (rotDeg !== 0) {
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.translate(-cx, -cy);
    }
    if (position && track.length > 1) {
      const n = track.length;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 3;
      for (let i = 1; i < n; i++) {
        const a = projectAt(track[i - 1], position, cx, cy, mpp);
        const b = projectAt(track[i], position, cx, cy, mpp);
        const opacity = 0.12 + 0.78 * (i / (n - 1));
        ctx.strokeStyle = `rgba(245, 166, 35, ${opacity.toFixed(2)})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
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

    // Ambient discovery candidates: faint mystery dots that gain a name + a
    // category glyph once you're within reveal range. On-canvas only (mystery
    // lives in the void, never as a rim chevron). Drawn under the user dot;
    // muted white, never amber — amber stays reserved for the destination.
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
    // the current `mpp`.
    const halfRadiusPx = rimR;
    const impliedMetres = halfRadiusPx * mpp;
    const snapMetres = nearestScaleLevel(impliedMetres);
    const keyPx = snapMetres / mpp;
    const sxRight = w - 18;
    const syBaseline = h - 22;
    ctx.strokeStyle = MUTED_TEXT;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sxRight - keyPx, syBaseline);
    ctx.lineTo(sxRight, syBaseline);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sxRight - keyPx, syBaseline - 3);
    ctx.lineTo(sxRight - keyPx, syBaseline + 3);
    ctx.moveTo(sxRight, syBaseline - 3);
    ctx.lineTo(sxRight, syBaseline + 3);
    ctx.stroke();
    ctx.fillStyle = MUTED_TEXT;
    ctx.font = "500 10px var(--font-mono), ui-monospace, monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(formatScale(snapMetres), sxRight, syBaseline - 7);
  }, [position, heading, track, targets, activeIndex, mpp, hideNumbers, candidates]);

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
  if (!c.revealed) {
    // Mystery: a faint, nameless point. The void stays calm.
    ctx.fillStyle = "rgba(237, 237, 237, 0.26)";
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  // Revealed: a brighter dot, a category glyph, and the name. A notable place
  // gets a subtle ring (the on-scope echo of the sheet's "✦ Noted").
  if (c.tier === "notable") {
    ctx.strokeStyle = "rgba(237, 237, 237, 0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(237, 237, 237, 0.85)";
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
  const emoji = c.category ? categoryByKey(c.category)?.emoji : undefined;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (emoji) {
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(emoji, x, y - 14);
  }
  if (c.name) {
    ctx.fillStyle = "rgba(237, 237, 237, 0.7)";
    ctx.font = "500 11px var(--font-sans), system-ui, sans-serif";
    ctx.fillText(truncate(c.name, 18), x, y + 16);
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
