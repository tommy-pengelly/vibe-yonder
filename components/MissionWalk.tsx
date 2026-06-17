"use client";
import { Compass, ExternalLink, Map as MapIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { ARRIVAL_RADIUS_M, DEFAULT_MPP } from "@/lib/constants";
import { crossTrack, fmtDist, haversine } from "@/lib/geo";
import { directionsOptions } from "@/lib/maps";
import { MEDAL_LABEL, medalFor } from "@/lib/straightline";
import type { ActiveYonder, Fix } from "@/lib/types";
import LaneScope from "./LaneScope";
import Scope from "./Scope";
import StatStrip from "./StatStrip";
import BottomSheet from "./ui/BottomSheet";
import CalibrateHint from "./walk/CalibrateHint";
import WalkControls from "./walk/WalkControls";
import WalkHeader from "./walk/WalkHeader";

// A straight-line mission: two clean steps. Step 1 — get to the start (a single
// arrow to A, untimed, no discovery/zoom). Step 2 — hold the line (the lane
// view, scored). No suggestions, nearbys, waypoints, favourites or pause.
type Props = {
  yonder: ActiveYonder;
  position: Fix | null;
  heading: number | null;
  track: Fix[];
  startTime: number | null;
  pausedMs: number;
  hideNumbers: boolean;
  onFinish: () => void;
  onDiscard: () => void;
  onArmLine: () => void;
  onCalibrate: () => void;
};

export default function MissionWalk({
  yonder,
  position,
  heading,
  track,
  startTime,
  pausedMs,
  hideNumbers,
  onFinish,
  onDiscard,
  onArmLine,
  onCalibrate,
}: Props) {
  const a = yonder.origin ?? null;
  const b = yonder.targets[0] ?? null;
  const armed = !!yonder.lineArmed;
  const [directionsOpen, setDirectionsOpen] = useState(false);
  // Default to the spinning, heading-up scope (clean, you-at-centre, the line +
  // corridor around you). Toggle to the lane "full map" overview when you want
  // to see the whole A→B and your trace.
  const [overview, setOverview] = useState(false);

  const distToStart =
    a && position ? haversine(position.lat, position.lon, a.lat, a.lon) : null;
  const atStart = distToStart != null && distToStart < ARRIVAL_RADIUS_M;
  const needsCalibration = position != null && heading == null;
  const isMission = !!yonder.missionId;

  const lineStats = useMemo(() => {
    if (!armed || !a || !b) return null;
    const armedAt = yonder.lineArmedAt ?? 0;
    const current = position ? Math.abs(crossTrack(position, a, b)) : 0;
    let worst = 0;
    for (const p of track) {
      if (p.t < armedAt) continue;
      const d = Math.abs(crossTrack(p, a, b));
      if (d > worst) worst = d;
    }
    return { current, worst, medal: medalFor(worst, yonder.bands) };
  }, [armed, a, b, position, track, yonder.lineArmedAt, yonder.bands]);

  // Step 1 shows just the start (A) as a single arrow, nothing else.
  const startTarget = a
    ? [{ id: "__start", name: "Start", lat: a.lat, lon: a.lon, visited: false }]
    : [];

  return (
    <div className="fixed inset-0 flex flex-col">
      {armed && a && b ? (
        <div className="absolute inset-0">
          {overview ? (
            <LaneScope position={position} a={a} b={b} track={track} hideNumbers={hideNumbers} bands={yonder.bands} />
          ) : (
            // The spinning heading-up scope, with the line + medal corridor drawn
            // around you (lineOrigin = A, B is the gold marker). Clean, not the
            // overwhelming fully-zoomed lane.
            <Scope
              position={position}
              heading={heading}
              track={track}
              targets={[b]}
              activeIndex={0}
              mpp={DEFAULT_MPP}
              hideNumbers={hideNumbers}
              minimal
              lineOrigin={a}
            />
          )}
        </div>
      ) : (
        <div className="absolute inset-0">
          <Scope
            position={position}
            heading={heading}
            track={track}
            targets={startTarget}
            activeIndex={a ? 0 : null}
            mpp={DEFAULT_MPP}
            hideNumbers={hideNumbers}
            minimal
            lineOrigin={null}
          />
        </div>
      )}

      <WalkHeader
        kicker={isMission ? "Straight-line mission" : "Straight line"}
        title={armed ? "Hold the line" : "Walk to the start"}
        right={
          armed && a && b ? (
            <button
              type="button"
              onClick={() => setOverview((v) => !v)}
              aria-label={overview ? "Line view" : "Full map"}
              aria-pressed={overview}
              className={`inline-flex items-center justify-center size-9 rounded-full border border-[var(--border)] bg-black/30 backdrop-blur-sm ${
                overview ? "text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {overview ? <Compass className="w-4 h-4" strokeWidth={1.75} /> : <MapIcon className="w-4 h-4" strokeWidth={1.75} />}
            </button>
          ) : undefined
        }
      />

      {/* Go-to-start: distance chip, or the Start button on arrival. */}
      {!armed && (
        <div className="relative z-10 -mt-1 flex justify-center pointer-events-auto">
          {atStart ? (
            <button
              type="button"
              onClick={onArmLine}
              className="rounded-full bg-[var(--accent)] text-black font-semibold px-6 py-2.5 active:opacity-80 shadow-lg"
            >
              {isMission ? "Start mission" : "Start the line"}
            </button>
          ) : (
            <div className="rounded-full bg-black/40 backdrop-blur-sm border border-[var(--border)] px-3 py-1.5 text-xs flex items-center gap-2">
              <span className="text-[var(--accent)]">The start</span>
              {!hideNumbers && distToStart != null && (
                <span className="font-mono text-[var(--muted)] tabular-nums">
                  {fmtDist(distToStart)}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Armed: live deviation + medal. */}
      {lineStats && (
        <div className="relative z-10 -mt-1 flex justify-center pointer-events-none">
          <div className="rounded-full bg-black/40 backdrop-blur-sm border border-[var(--border)] px-3 py-1.5 text-xs flex items-center gap-2">
            <span className="font-mono text-[var(--accent)]">
              {MEDAL_LABEL[lineStats.medal]}
            </span>
            {!hideNumbers && (
              <span className="font-mono text-[var(--muted)] tabular-nums">
                ±{Math.round(lineStats.current)}m · worst {Math.round(lineStats.worst)}m
              </span>
            )}
          </div>
        </div>
      )}

      <div className="relative z-10 flex-1 flex flex-col justify-end px-5 pb-8 gap-4 pointer-events-none">
        {!position && (
          <p className="text-center text-xs text-[var(--muted)]">Searching for signal…</p>
        )}
        {needsCalibration && <CalibrateHint onCalibrate={onCalibrate} />}

        <div className="flex flex-col gap-3 pointer-events-auto">
          {armed ? (
            !hideNumbers && (
              <StatStrip track={track} startTime={startTime} pausedMs={pausedMs} paused={false} />
            )
          ) : (
            <p className="text-center text-sm text-[var(--muted)]">
              {atStart
                ? `You're at the start. ${isMission ? "Start the mission" : "Start the line"} when you're ready, the clock starts then.`
                : "Find your way to the start. Nothing's timed yet, this is just the way there."}
            </p>
          )}

          {armed ? (
            <WalkControls
              paused={false}
              pausable={false}
              onPause={() => {}}
              onResume={() => {}}
              onFinish={onFinish}
              onDiscard={onDiscard}
              finishLabel="Finish"
            />
          ) : (
            <div className="flex items-center justify-between gap-3 pt-1">
              {a && (
                <button
                  type="button"
                  onClick={() => setDirectionsOpen(true)}
                  className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] inline-flex items-center gap-1"
                >
                  Directions to the start
                  <ExternalLink className="w-3 h-3" strokeWidth={1.75} />
                </button>
              )}
              <div className="flex-1" />
              <button
                type="button"
                onClick={onDiscard}
                className="rounded-full border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] font-semibold px-5 py-2 bg-black/30 backdrop-blur-sm"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {a && (
        <BottomSheet
          open={directionsOpen}
          onClose={() => setDirectionsOpen(false)}
          title="Get to the start"
        >
          <p className="text-xs text-[var(--muted)] -mt-1">
            Hand off to a maps app to reach the start, then come back to walk the line.
          </p>
          <ul className="flex flex-col divide-y divide-[var(--border)]">
            {directionsOptions(a).map((o) => (
              <li key={o.id}>
                <a
                  href={o.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setDirectionsOpen(false)}
                  className="flex items-center justify-between py-3 hover:text-[var(--accent)]"
                >
                  <span className="font-display text-lg">{o.label}</span>
                  <ExternalLink className="w-4 h-4 text-[var(--muted)]" strokeWidth={1.75} />
                </a>
              </li>
            ))}
          </ul>
        </BottomSheet>
      )}
    </div>
  );
}
