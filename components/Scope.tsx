"use client";
import { useEffect, useRef } from "react";
import {
  bearing,
  fmtDist,
  haversine,
  makeAngleSmoother,
  toRad,
} from "@/lib/geo";
import type { Destination, Fix, LatLon } from "@/lib/types";

type Props = {
  position: Fix | null;
  heading: number | null;
  track: Fix[];
  destination: Destination;
  mpp: number;
  hideNumbers: boolean;
};

const ACCENT = "#f5a623";
const FG = "#ededed";
const MUTED = "rgba(173, 168, 157, 0.55)";
const KEY_METRES = 100;

export default function Scope({
  position,
  heading,
  track,
  destination,
  mpp,
  hideNumbers,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotSmoother = useRef(makeAngleSmoother());
  const bearingSmoother = useRef(makeAngleSmoother());

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

    // Heading-up only. When no compass, freeze orientation (rot = 0).
    const rotDeg = heading != null ? rotSmoother.current(-heading) : 0;

    // --- World space (rotates with the scope when heading-up) ---
    ctx.save();
    if (rotDeg !== 0) {
      ctx.translate(cx, cy);
      ctx.rotate((rotDeg * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }

    // Trail — older fades away.
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

    // If the destination is close enough to be drawn on the scope, render it
    // as a dot at its true position. Otherwise it shows as the directional
    // head, outside this rotated block.
    let destOnCanvas = false;
    let destDist = 0;
    let destBearing = 0;
    if (position) {
      destDist = haversine(
        position.lat,
        position.lon,
        destination.lat,
        destination.lon,
      );
      destBearing = bearing(
        position.lat,
        position.lon,
        destination.lat,
        destination.lon,
      );
      const screenPx = destDist / mpp;
      const onCanvasRadius = Math.min(w, h) * 0.30;
      if (screenPx < onCanvasRadius) {
        const p = projectAt(destination, position, cx, cy, mpp);
        // Soft amber glow at the spot
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 18);
        glow.addColorStop(0, "rgba(245, 166, 35, 0.45)");
        glow.addColorStop(1, "rgba(245, 166, 35, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
        ctx.fill();
        // The dot itself
        ctx.fillStyle = ACCENT;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();
        destOnCanvas = true;
      }
    }

    ctx.restore();

    // --- Screen space (does not rotate with the scope) ---

    // The dot: crisp white with soft static glow. Dimmer while acquiring.
    const acquiring = !position;
    const dotOpacity = acquiring ? 0.45 : 1;
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

    // Directional head + label when the destination is off-canvas.
    if (position && !destOnCanvas) {
      const relBrg =
        heading != null ? destBearing - heading : destBearing;
      const smoothed = bearingSmoother.current(relBrg);
      const a = (smoothed * Math.PI) / 180;
      const R = Math.min(w, h) * 0.34;
      const tx = cx + R * Math.sin(a);
      const ty = cy - R * Math.cos(a);

      // Chevron — small triangle pointing outward.
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(a);
      ctx.fillStyle = ACCENT;
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(9, 7);
      ctx.lineTo(0, 3);
      ctx.lineTo(-9, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Label sits beneath the chevron, screen-upright. Distance + place name.
      const labelOffset = 30;
      const lx = cx + (R + labelOffset) * Math.sin(a);
      const ly = cy - (R + labelOffset) * Math.cos(a);
      const nameLine = truncate(destination.name, 24);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      if (!hideNumbers) {
        ctx.fillStyle = FG;
        ctx.font = "600 18px var(--font-display), Georgia, serif";
        ctx.fillText(fmtDist(destDist), lx, ly);
        ctx.fillStyle = MUTED;
        ctx.font = "500 11px var(--font-sans), system-ui, sans-serif";
        ctx.fillText(nameLine, lx, ly + 16);
      } else {
        ctx.fillStyle = FG;
        ctx.font = "500 13px var(--font-sans), system-ui, sans-serif";
        ctx.fillText(nameLine, lx, ly);
      }
    }

    // Subtle scale key, bottom-right. Communicates the (invisible) range.
    const keyPx = KEY_METRES / mpp;
    const sxRight = w - 18;
    const syBaseline = h - 22;
    ctx.strokeStyle = MUTED;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sxRight - keyPx, syBaseline);
    ctx.lineTo(sxRight, syBaseline);
    ctx.stroke();
    // little end-ticks
    ctx.beginPath();
    ctx.moveTo(sxRight - keyPx, syBaseline - 3);
    ctx.lineTo(sxRight - keyPx, syBaseline + 3);
    ctx.moveTo(sxRight, syBaseline - 3);
    ctx.lineTo(sxRight, syBaseline + 3);
    ctx.stroke();
    ctx.fillStyle = MUTED;
    ctx.font = "500 10px var(--font-mono), ui-monospace, monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(
      KEY_METRES < 1000 ? `${KEY_METRES} m` : `${KEY_METRES / 1000} km`,
      sxRight,
      syBaseline - 7,
    );
  }, [position, heading, track, destination, mpp, hideNumbers]);

  return (
    <div className="scope-wrap">
      <canvas ref={canvasRef} aria-label="Yonder scope" />
    </div>
  );
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
