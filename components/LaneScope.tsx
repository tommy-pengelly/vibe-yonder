"use client";
import { useEffect, useRef } from "react";
import { alongFraction, crossTrack, fmtDist, haversine } from "@/lib/geo";
import { bandList, DEFAULT_BANDS, type MedalBands } from "@/lib/straightline";
import type { Fix, LatLon } from "@/lib/types";

// The straight-line "lane" view. The line A→B runs up the screen (A at the
// bottom, B at the top). Your dot climbs as you progress and slides left/right
// with live deviation, against the medal corridor lanes, so you can see — and
// correct — your drift. Deviation (x) is exaggerated vs distance (y).
export default function LaneScope({
  position,
  a,
  b,
  track,
  hideNumbers,
  bands = DEFAULT_BANDS,
}: {
  position: Fix | null;
  a: LatLon;
  b: LatLon;
  track: Fix[];
  hideNumbers: boolean;
  bands?: MedalBands;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
    const topY = h * 0.16; // B
    const botY = h * 0.82; // A
    const MAX_DEV = 120; // metres mapped to the lane half-width
    const halfW = w * 0.4;
    const pxPerM = halfW / MAX_DEV;
    const yAt = (f: number) => botY - f * (botY - topY);
    const xAt = (devM: number) =>
      cx + Math.max(-MAX_DEV, Math.min(MAX_DEV, devM)) * pxPerM;

    // Corridor as a target zone: faint amber fills tightening toward the centre.
    for (const band of [...bandList(bands)].reverse()) {
      const bw = band.half * pxPerM;
      ctx.fillStyle = "rgba(245, 166, 35, 0.05)";
      ctx.fillRect(cx - bw, topY, bw * 2, botY - topY);
    }
    // Lane lines at each medal threshold.
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 1;
    for (const band of bandList(bands)) {
      const bw = band.half * pxPerM;
      ctx.strokeStyle = "rgba(245, 166, 35, 0.22)";
      ctx.beginPath();
      ctx.moveTo(cx - bw, topY);
      ctx.lineTo(cx - bw, botY);
      ctx.moveTo(cx + bw, topY);
      ctx.lineTo(cx + bw, botY);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // The centre line A→B.
    ctx.strokeStyle = "rgba(245, 166, 35, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, botY);
    ctx.lineTo(cx, topY);
    ctx.stroke();

    // Endpoints.
    for (const [py, label] of [
      [botY, "A"],
      [topY, "B"],
    ] as const) {
      ctx.fillStyle = "#f5a623";
      ctx.beginPath();
      ctx.arc(cx, py, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(173, 168, 157, 0.7)";
      ctx.font = "500 11px var(--font-mono), ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, cx + 16, py);
    }

    // Your trace, in the lane frame.
    if (track.length > 1) {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 3;
      for (let i = 1; i < track.length; i++) {
        const p0 = track[i - 1];
        const p1 = track[i];
        const opacity = 0.12 + 0.78 * (i / (track.length - 1));
        ctx.strokeStyle = `rgba(245, 166, 35, ${opacity.toFixed(2)})`;
        ctx.beginPath();
        ctx.moveTo(xAt(crossTrack(p0, a, b)), yAt(alongFraction(p0, a, b)));
        ctx.lineTo(xAt(crossTrack(p1, a, b)), yAt(alongFraction(p1, a, b)));
        ctx.stroke();
      }
    }

    // You: an upward arrowhead at your live (along, deviation).
    if (position) {
      const x = xAt(crossTrack(position, a, b));
      const y = yAt(alongFraction(position, a, b));
      ctx.fillStyle = "#ededed";
      ctx.beginPath();
      ctx.moveTo(x, y - 11);
      ctx.lineTo(x + 8, y + 8);
      ctx.lineTo(x, y + 3);
      ctx.lineTo(x - 8, y + 8);
      ctx.closePath();
      ctx.fill();

      if (!hideNumbers) {
        const toB = haversine(position.lat, position.lon, b.lat, b.lon);
        ctx.fillStyle = "rgba(173, 168, 157, 0.7)";
        ctx.font = "500 11px var(--font-mono), ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(`${fmtDist(toB)} to B`, cx, topY - 12);
      }
    }
  }, [position, a, b, track, hideNumbers, bands]);

  return (
    <div className="scope-wrap">
      <canvas ref={canvasRef} aria-label="Straight-line lane" />
    </div>
  );
}
