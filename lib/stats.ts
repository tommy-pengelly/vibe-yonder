import { haversine } from "./geo";
import type { Fix } from "./types";

export type WalkSummary = {
  walked: number;
  direct: number;
  durationMs: number;
  yondered: number;
};

export function summarize(
  track: Fix[],
  startTime: number | null,
  pausedMs: number,
  now: number = Date.now(),
): WalkSummary {
  let walked = 0;
  for (let i = 1; i < track.length; i++) {
    walked += haversine(
      track[i - 1].lat,
      track[i - 1].lon,
      track[i].lat,
      track[i].lon,
    );
  }

  const last = track.at(-1);
  const direct =
    track.length > 1 && last
      ? haversine(track[0].lat, track[0].lon, last.lat, last.lon)
      : 0;

  const durationMs = startTime ? Math.max(0, now - startTime - pausedMs) : 0;
  const yondered = direct > 5 ? walked / direct : 1;

  return { walked, direct, durationMs, yondered };
}

export function projectTrack(
  track: Fix[],
  W = 320,
  H = 320,
  pad = 24,
): Array<readonly [number, number]> {
  if (track.length === 0) return [];
  const lats = track.map((p) => p.lat);
  const lons = track.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const span = Math.max((maxLon - minLon) * kx, maxLat - minLat, 1e-7);
  const rangeW = W - 2 * pad;
  const rangeH = H - 2 * pad;
  // Centre the shorter axis so the constellation sits in the middle of the
  // frame, not pinned to a corner (one shared span keeps the shape's aspect).
  const offX = (rangeW - (((maxLon - minLon) * kx) / span) * rangeW) / 2;
  const offY = (rangeH - ((maxLat - minLat) / span) * rangeH) / 2;
  return track.map(
    (p) =>
      [
        pad + offX + (((p.lon - minLon) * kx) / span) * rangeW,
        H - pad - offY - ((p.lat - minLat) / span) * rangeH,
      ] as const,
  );
}
