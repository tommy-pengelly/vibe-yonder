"use client";
import { useEffect, useRef } from "react";
import {
  bearing,
  edgeArrow,
  fmtDist,
  haversine,
  makeAngleSmoother,
  toRad,
  toScreen,
} from "@/lib/geo";
import type { Destination, Fix, Poi } from "@/lib/types";

type Props = {
  position: Fix;
  heading: number | null;
  headingUp: boolean;
  track: Fix[];
  destination: Destination;
  pois: Poi[];
  mpp: number;
};

const ACCENT = "#f5a524";
const FG = "#ededed";

export default function Minimap({
  position,
  heading,
  headingUp,
  track,
  destination,
  pois,
  mpp,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rotSmoother = useRef(makeAngleSmoother());

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (w === 0 || h === 0) return;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const rotDeg =
      headingUp && heading != null ? rotSmoother.current(-heading) : 0;
    if (rotDeg !== 0) {
      ctx.translate(w / 2, h / 2);
      ctx.rotate((rotDeg * Math.PI) / 180);
      ctx.translate(-w / 2, -h / 2);
    }

    if (track.length > 1) {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 3;
      const n = track.length;
      for (let i = 1; i < n; i++) {
        const a = toScreen(track[i - 1], position, w, h, mpp);
        const b = toScreen(track[i], position, w, h, mpp);
        const opacity = 0.15 + 0.85 * (i / (n - 1));
        ctx.strokeStyle = `rgba(245, 165, 36, ${opacity.toFixed(2)})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    ctx.fillStyle = FG;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
    ctx.lineWidth = 2;
    ctx.stroke();

    const R = Math.min(w, h) * 0.42;
    const distToDest = haversine(
      position.lat,
      position.lon,
      destination.lat,
      destination.lon,
    );
    const brgToDest = bearing(
      position.lat,
      position.lon,
      destination.lat,
      destination.lon,
    );
    const dest = edgeArrow(brgToDest, R, w, h);
    drawArrow(ctx, dest.x, dest.y, dest.rot, ACCENT, 1, 18);

    ctx.fillStyle = FG;
    ctx.font = "600 13px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const labelInset = 32;
    const a = toRad(brgToDest);
    const lx = w / 2 + (R - labelInset) * Math.sin(a);
    const ly = h / 2 - (R - labelInset) * Math.cos(a);
    ctx.fillText(fmtDist(distToDest), lx, ly);

    const unseen = pois
      .filter((p) => !p.seen)
      .map((p) => ({
        p,
        dist: haversine(position.lat, position.lon, p.lat, p.lon),
        brg: bearing(position.lat, position.lon, p.lat, p.lon),
      }))
      .sort((x, y) => x.dist - y.dist)
      .slice(0, 5);
    if (unseen.length > 0) {
      const maxD = unseen[unseen.length - 1].dist || 1;
      for (const { dist, brg } of unseen) {
        const closeness = 1 - dist / maxD;
        const opacity = 0.22 + 0.45 * closeness;
        const size = 11 + 5 * closeness;
        const g = edgeArrow(brg, R * 0.86, w, h);
        drawArrow(ctx, g.x, g.y, g.rot, FG, opacity, size);
      }
    }

    if (!headingUp || heading == null) {
      ctx.fillStyle = "rgba(245, 165, 36, 0.85)";
      ctx.font = "600 11px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("N", w / 2, 16);
    }
  }, [position, heading, headingUp, track, destination, pois, mpp]);

  return (
    <div ref={wrapRef} className="minimap-wrap h-[58vh] bg-[var(--surface)]">
      <canvas ref={canvasRef} aria-label="Walking minimap" />
    </div>
  );
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rotDeg: number,
  color: string,
  opacity: number,
  size: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((rotDeg * Math.PI) / 180);
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.6, size * 0.55);
  ctx.lineTo(0, size * 0.2);
  ctx.lineTo(-size * 0.6, size * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
