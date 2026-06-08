"use client";
import { useEffect, useRef } from "react";
import {
  bearing,
  fmtDist,
  haversine,
  makeAngleSmoother,
  toRad,
} from "@/lib/geo";
import type { Fix, LatLon, Target } from "@/lib/types";

type Props = {
  position: Fix | null;
  heading: number | null;
  track: Fix[];
  targets: Target[];
  /** Index of the bold target in `targets`, or null in Collection mode. */
  activeIndex: number | null;
  mpp: number;
  hideNumbers: boolean;
  panOffset: { x: number; y: number };
};

const ACCENT = "#f5a623";
const FG = "#ededed";
const MUTED_TEXT = "rgba(173, 168, 157, 0.55)";
const RIM_FRACTION = 0.42;
const FADE_START = 0.7;

const SCALE_LEVELS_M = [25, 50, 100, 250, 500, 1000, 2500, 5000];

export default function Scope({
  position,
  heading,
  track,
  targets,
  activeIndex,
  mpp,
  hideNumbers,
  panOffset,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotSmoother = useRef(makeAngleSmoother());

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

    const baseCx = w / 2;
    const baseCy = h * 0.45;
    const cx = baseCx + panOffset.x;
    const cy = baseCy + panOffset.y;

    const rimR = Math.min(w, h) * RIM_FRACTION;
    const rotDeg = heading != null ? rotSmoother.current(-heading) : 0;

    // --- World space (rotates with the scope when a heading is available) ---
    ctx.save();
    if (rotDeg !== 0) {
      ctx.translate(cx, cy);
      ctx.rotate((rotDeg * Math.PI) / 180);
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

    // Targets — for each unvisited target, draw either a dot (true position,
    // fades radially as it nears the rim) or a chevron at the rim.
    type TargetState = {
      target: Target;
      idx: number;
      isActive: boolean;
      dist: number;
      brg: number;
      inCircle: boolean;
      dotOpacity: number; // 0..1 if in-circle
      screen?: { x: number; y: number };
    };

    const states: TargetState[] = [];
    if (position) {
      targets.forEach((t, i) => {
        if (t.visited) return;
        const dist = haversine(position.lat, position.lon, t.lat, t.lon);
        const brg = bearing(position.lat, position.lon, t.lat, t.lon);
        const screen = projectAt(t, position, cx, cy, mpp);
        const dx = screen.x - cx;
        const dy = screen.y - cy;
        const r = Math.hypot(dx, dy);
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
          idx: i,
          isActive: i === activeIndex,
          dist,
          brg,
          inCircle,
          dotOpacity,
          screen,
        });
      });
    }

    // First pass: draw in-circle targets as dots at their true positions.
    for (const s of states) {
      if (!s.inCircle || !s.screen) continue;
      const opacity = s.isActive ? s.dotOpacity : s.dotOpacity * 0.45;
      drawDestDot(ctx, s.screen.x, s.screen.y, opacity, s.isActive);
    }
    ctx.restore();

    // --- Screen space (doesn't rotate with the scope) ---

    // The dot: crisp white with soft static glow. Dimmer while acquiring.
    const acquiring = !position;
    const dotOpacity = acquiring ? 0.45 : 1;
    {
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 28);
      glow.addColorStop(0, `rgba(255, 255, 255, ${0.22 * dotOpacity})`);
      glow.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(237, 237, 237, ${dotOpacity})`;
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    // Rim chevrons for out-of-circle targets, drawn in screen space so they
    // ride on a fixed invisible radius and stay readable.
    const chevronR = Math.min(w, h) * 0.36;
    const labelR = chevronR + 28;

    let activeLabel: {
      x: number;
      y: number;
      dist: number;
      name: string;
    } | null = null;

    for (const s of states) {
      if (s.inCircle) {
        // If it's the active in-circle dot, schedule a label.
        if (s.isActive && s.screen) {
          activeLabel = {
            x: s.screen.x,
            y: s.screen.y + 22,
            dist: s.dist,
            name: s.target.name,
          };
        }
        continue;
      }
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

      if (s.isActive) {
        const lx = cx + labelR * Math.sin(a);
        const ly = cy - labelR * Math.cos(a);
        activeLabel = { x: lx, y: ly, dist: s.dist, name: s.target.name };
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
  }, [position, heading, track, targets, activeIndex, mpp, hideNumbers, panOffset]);

  return (
    <div className="scope-wrap">
      <canvas ref={canvasRef} aria-label="Yonder scope" />
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
  const glowRadius = isActive ? 20 : 12;
  const dotRadius = isActive ? 6 : 4;
  const glowAlpha = (isActive ? 0.45 : 0.25) * opacity;
  const glow = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
  glow.addColorStop(0, `rgba(245, 166, 35, ${glowAlpha.toFixed(2)})`);
  glow.addColorStop(1, "rgba(245, 166, 35, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(245, 166, 35, ${opacity.toFixed(2)})`;
  ctx.beginPath();
  ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
  ctx.fill();
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
