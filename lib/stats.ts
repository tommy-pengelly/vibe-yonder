import { haversine } from "./geo";
import type { Fix } from "./types";

export type WalkSummary = {
  walked: number;
  straight: number;
  durationMs: number;
  pace: number;
  wander: number;
};

export function summarize(track: Fix[], startTime: number | null): WalkSummary {
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
  const straight =
    track.length > 1 && last
      ? haversine(track[0].lat, track[0].lon, last.lat, last.lon)
      : 0;

  const endT = last?.t ?? (startTime ?? Date.now());
  const durationMs = startTime ? Math.max(0, endT - startTime) : 0;
  const minutes = durationMs / 60000;
  const km = walked / 1000;
  const pace = km > 0 ? minutes / km : 0;
  const wander = straight > 5 ? walked / straight : 1;

  return { walked, straight, durationMs, pace, wander };
}

export function projectTrack(
  track: Fix[],
  W = 300,
  H = 300,
  pad = 30,
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
  return track.map(
    (p) =>
      [
        pad + (((p.lon - minLon) * kx) / span) * (W - 2 * pad),
        H - pad - ((p.lat - minLat) / span) * (H - 2 * pad),
      ] as const,
  );
}
