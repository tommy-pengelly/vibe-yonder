"use client";
import { useEffect, useRef } from "react";
import { bearing, fmtDist, haversine, makeAngleSmoother, toRad } from "@/lib/geo";
import type { Destination, Fix } from "@/lib/types";

type Props = {
  position: Fix | null;
  heading: number | null;
  headingUp: boolean;
  track: Fix[];
  destination: Destination;
  mpp: number;
};

const ACCENT = "#f5a623";
const FG = "#ededed";
const RING_RADII_M = [100, 250, 500];

export default function Scope({
  position,
  heading,
  headingUp,
  track,
  destination,
  mpp,
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

    const cx = w / 2;
    const cy = h * 0.45;

    const rotDeg =
      headingUp && heading != null ? rotSmoother.current(-heading) : 0;
    ctx.save();
    if (rotDeg !== 0) {
      ctx.translate(cx, cy);
      ctx.rotate((rotDeg * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }

    // Concentric range rings + distance ticks (subtle)
    ctx.strokeStyle = "rgba(125, 122, 118, 0.18)";
    ctx.lineWidth = 1;
    ctx.fillStyle = "rgba(125, 122, 118, 0.42)";
    ctx.font = "500 10px var(--font-mono), ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    for (const metres of RING_RADII_M) {
      const r = metres / mpp;
      if (r < 20 || r > Math.max(w, h)) continue;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillText(
        metres < 1000 ? `${metres} m` : `${metres / 1000} km`,
        cx,
        cy - r - 6,
      );
    }

    // N tick on the top ring (always — drawn before rotation? actually inside, so it rotates with scope. That matches "N tick on top ring" only when north-up.)
    if (!headingUp || heading == null) {
      const topR = RING_RADII_M[RING_RADII_M.length - 1] / mpp;
      const ny = cy - topR - 18;
      ctx.fillStyle = "rgba(245, 166, 35, 0.7)";
      ctx.font = "600 11px var(--font-sans), system-ui, sans-serif";
      ctx.fillText("N", cx, ny);
    }

    // Trail — older fades into the rings
    if (position && track.length > 1) {
      const n = track.length;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 3;
      for (let i = 1; i < n; i++) {
        const a = toScreenAt(track[i - 1], position, cx, cy, mpp);
        const b = toScreenAt(track[i], position, cx, cy, mpp);
        const recency = i / (n - 1);
        const opacity = 0.15 + 0.75 * recency;
        ctx.strokeStyle = `rgba(245, 166, 35, ${opacity.toFixed(2)})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    ctx.restore();

    // ---- Drawn UNROTATED so it stays anchored to viewer ----

    // You-dot: crisp white with soft static glow. Dimmer while acquiring.
    const acquiring = !position;
    const dotOpacity = acquiring ? 0.45 : 1;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 28);
    glow.addColorStop(0, `rgba(255, 255, 255, ${0.25 * dotOpacity})`);
    glow.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(237, 237, 237, ${dotOpacity})`;
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fill();

    // Hero arrow anchored to you-dot, pointing at destination.
    if (position) {
      const brg = bearing(
        position.lat,
        position.lon,
        destination.lat,
        destination.lon,
      );
      const showAngle =
        headingUp && heading != null
          ? brg - heading
          : brg;
      const a = toRad(showAngle);
      const dist = haversine(
        position.lat,
        position.lon,
        destination.lat,
        destination.lon,
      );

      // Tail anchors at you-dot; arrow extends outward along the bearing.
      const ARROW_LEN = Math.min(w, h) * 0.22;
      const tipX = cx + Math.sin(a) * ARROW_LEN;
      const tipY = cy - Math.cos(a) * ARROW_LEN;

      ctx.save();
      ctx.translate(tipX, tipY);
      ctx.rotate(a);

      // soft amber glow at tip
      const tipGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, 40);
      tipGlow.addColorStop(0, "rgba(245, 166, 35, 0.35)");
      tipGlow.addColorStop(1, "rgba(245, 166, 35, 0)");
      ctx.fillStyle = tipGlow;
      ctx.beginPath();
      ctx.arc(0, 0, 40, 0, Math.PI * 2);
      ctx.fill();

      // arrow head
      ctx.fillStyle = ACCENT;
      const headSize = 22;
      ctx.beginPath();
      ctx.moveTo(0, -headSize);
      ctx.lineTo(headSize * 0.7, headSize * 0.55);
      ctx.lineTo(0, headSize * 0.2);
      ctx.lineTo(-headSize * 0.7, headSize * 0.55);
      ctx.closePath();
      ctx.fill();

      // shaft
      ctx.strokeStyle = ACCENT;
      ctx.lineCap = "round";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, headSize * 0.4);
      ctx.lineTo(0, ARROW_LEN);
      ctx.stroke();

      ctx.restore();

      // Distance label rides past the arrow tip in the same direction.
      const labelOffset = 36;
      const lx = cx + Math.sin(a) * (ARROW_LEN + labelOffset);
      const ly = cy - Math.cos(a) * (ARROW_LEN + labelOffset);
      ctx.fillStyle = FG;
      ctx.font =
        "600 22px var(--font-display), Georgia, serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(fmtDist(dist), lx, ly);
    }
  }, [position, heading, headingUp, track, destination, mpp]);

  return (
    <div className="scope-wrap">
      <canvas ref={canvasRef} aria-label="Walking scope" />
    </div>
  );
}

function toScreenAt(p: Fix, me: Fix, cx: number, cy: number, mpp: number) {
  const kx = Math.cos(toRad(me.lat));
  const east = (p.lon - me.lon) * kx * 111320;
  const north = (p.lat - me.lat) * 110540;
  return { x: cx + east / mpp, y: cy - north / mpp };
}
