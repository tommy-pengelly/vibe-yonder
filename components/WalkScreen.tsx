"use client";
import { useMemo, useState } from "react";
import { haversine } from "@/lib/geo";
import { externalDirectionsUrl } from "@/lib/maps";
import type { Destination, Fix, Journey, Poi } from "@/lib/types";
import Minimap from "./Minimap";
import StatStrip from "./StatStrip";

type Props = {
  destination: Destination;
  journey: Journey | null;
  position: Fix | null;
  heading: number | null;
  track: Fix[];
  pois: Poi[];
  startTime: number | null;
  pausedMs: number;
  paused: boolean;
  geoError: string | null;
  mpp: number;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  onCancel: () => void;
  onAdvanceJourney: () => void;
};

const NEAR_WAYPOINT_M = 30;

export default function WalkScreen({
  destination,
  journey,
  position,
  heading,
  track,
  pois,
  startTime,
  pausedMs,
  paused,
  geoError,
  mpp,
  onPause,
  onResume,
  onFinish,
  onCancel,
  onAdvanceJourney,
}: Props) {
  const [headingUp, setHeadingUp] = useState(false);

  const journeyLabel = useMemo(() => {
    if (!journey) return null;
    return `Waypoint ${journey.activeIndex + 1} of ${journey.waypoints.length}`;
  }, [journey]);

  const distance =
    position &&
    haversine(position.lat, position.lon, destination.lat, destination.lon);

  const nearActiveWaypoint =
    distance != null && distance < NEAR_WAYPOINT_M && journey != null;
  const isLastWaypoint =
    journey != null && journey.activeIndex === journey.waypoints.length - 1;

  return (
    <div className="flex-1 flex flex-col w-full max-w-md mx-auto px-4 pt-5 pb-6 gap-4">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
            {journeyLabel ?? "Heading to"}
          </span>
          <h1 className="text-lg font-semibold truncate">{destination.name}</h1>
        </div>
        <div className="flex items-center gap-3 shrink-0 mt-0.5">
          <button
            type="button"
            onClick={() => setHeadingUp((v) => !v)}
            className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-40"
            disabled={heading == null}
            title={heading == null ? "No compass" : undefined}
          >
            {headingUp && heading != null ? "Heading-up" : "North-up"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            Cancel
          </button>
        </div>
      </header>

      <div className="rounded-2xl overflow-hidden border border-[var(--border)]">
        {position ? (
          <Minimap
            position={position}
            heading={heading}
            headingUp={headingUp}
            track={track}
            destination={destination}
            pois={pois}
            mpp={mpp}
          />
        ) : (
          <div className="h-[58vh] flex items-center justify-center text-sm text-[var(--muted)] bg-[var(--surface)]">
            Acquiring location…
          </div>
        )}
      </div>

      <StatStrip
        track={track}
        startTime={startTime}
        pausedMs={pausedMs}
        paused={paused}
      />

      {nearActiveWaypoint && (
        <button
          type="button"
          onClick={onAdvanceJourney}
          className="rounded-xl bg-[var(--accent)] text-black font-semibold py-3 active:opacity-80"
        >
          {isLastWaypoint ? "Finish journey" : "Arrived? · Next point"}
        </button>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={paused ? onResume : onPause}
          aria-label={paused ? "Resume" : "Pause"}
          className="size-14 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center active:bg-[var(--surface-2)]"
        >
          {paused ? (
            <PlayIcon className="w-5 h-5" />
          ) : (
            <PauseIcon className="w-5 h-5" />
          )}
        </button>
        <button
          type="button"
          onClick={onFinish}
          className="flex-1 rounded-full bg-[var(--accent)] text-black font-semibold py-4 active:opacity-80"
        >
          Finish
        </button>
      </div>

      <div className="flex items-center justify-center">
        <a
          href={externalDirectionsUrl(destination)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          Just take me there ↗
        </a>
      </div>

      <div className="text-center text-xs text-[var(--muted)] min-h-4">
        {geoError === "permission-denied" && (
          <p className="text-red-400">
            Location permission denied. Enable it in your browser settings.
          </p>
        )}
        {geoError === "unavailable" && (
          <p className="text-red-400">
            Location unavailable. Try outdoors with a clear sky view.
          </p>
        )}
        {position?.acc != null && <p>GPS accuracy ±{Math.round(position.acc)} m</p>}
      </div>
    </div>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M7 5v14l12-7L7 5z" />
    </svg>
  );
}
