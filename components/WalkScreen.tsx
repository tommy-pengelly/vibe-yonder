"use client";
import { useMemo } from "react";
import { haversine } from "@/lib/geo";
import { externalDirectionsUrl } from "@/lib/maps";
import type { Destination, Fix, ListJourney } from "@/lib/types";
import Scope from "./Scope";
import StatStrip from "./StatStrip";

type Props = {
  destination: Destination;
  journey: ListJourney | null;
  position: Fix | null;
  heading: number | null;
  track: Fix[];
  startTime: number | null;
  pausedMs: number;
  paused: boolean;
  geoError: string | null;
  mpp: number;
  hideNumbers: boolean;
  onToggleHideNumbers: () => void;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  onDiscard: () => void;
  onAdvanceJourney: () => void;
  onCalibrate: () => void;
};

const NEAR_WAYPOINT_M = 30;

export default function WalkScreen({
  destination,
  journey,
  position,
  heading,
  track,
  startTime,
  pausedMs,
  paused,
  geoError,
  mpp,
  hideNumbers,
  onToggleHideNumbers,
  onPause,
  onResume,
  onFinish,
  onDiscard,
  onAdvanceJourney,
  onCalibrate,
}: Props) {
  const waypointLabel = useMemo(() => {
    if (!journey) return null;
    return `Waypoint ${journey.activeIndex + 1} of ${journey.list.items.length}`;
  }, [journey]);

  const distance =
    position &&
    haversine(position.lat, position.lon, destination.lat, destination.lon);

  const nearActiveWaypoint =
    distance != null && distance < NEAR_WAYPOINT_M && journey != null;
  const isLastWaypoint =
    journey != null && journey.activeIndex === journey.list.items.length - 1;

  const needsCalibration = position != null && heading == null;

  return (
    <div className="fixed inset-0 flex flex-col">
      <Scope
        position={position}
        heading={heading}
        track={track}
        destination={destination}
        mpp={mpp}
        hideNumbers={hideNumbers}
      />

      <header className="relative z-10 flex items-start justify-between gap-3 px-5 pt-6">
        <div className="flex flex-col min-w-0">
          {waypointLabel && (
            <span className="text-[10px] uppercase tracking-widest text-[var(--accent)]/80">
              {waypointLabel}
            </span>
          )}
          <h1 className="font-display text-2xl tracking-tight leading-tight truncate">
            {destination.name}
          </h1>
        </div>
        <button
          type="button"
          onClick={onToggleHideNumbers}
          aria-label={hideNumbers ? "Show numbers" : "Hide numbers"}
          title={hideNumbers ? "Show numbers" : "Hide numbers"}
          className="size-9 rounded-full flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          {hideNumbers ? (
            <EyeOffIcon className="w-4 h-4" />
          ) : (
            <EyeIcon className="w-4 h-4" />
          )}
        </button>
      </header>

      <div className="relative z-10 flex-1 flex flex-col justify-end px-5 pb-8 gap-4">
        {!position && (
          <p className="text-center text-xs text-[var(--muted)]">
            Searching for signal…
          </p>
        )}

        {needsCalibration && (
          <div className="self-center text-center text-xs text-[var(--muted)] max-w-xs">
            Wave the phone in a figure-8 to calibrate the compass.
            <button
              type="button"
              onClick={onCalibrate}
              className="block mx-auto mt-2 text-[var(--accent)] hover:opacity-80"
            >
              Tap to ask permission again
            </button>
          </div>
        )}

        {nearActiveWaypoint && (
          <button
            type="button"
            onClick={onAdvanceJourney}
            className="self-center rounded-full bg-[var(--accent)] text-black font-semibold px-5 py-2.5 active:opacity-80"
          >
            {isLastWaypoint ? "Finish journey" : "Arrived? · Next point"}
          </button>
        )}

        <div className="flex flex-col gap-3">
          {!hideNumbers && (
            <StatStrip
              track={track}
              startTime={startTime}
              pausedMs={pausedMs}
              paused={paused}
            />
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            {paused ? (
              <>
                <button
                  type="button"
                  onClick={onDiscard}
                  className="text-xs text-[var(--muted)] hover:text-red-400 px-2 py-1"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={onResume}
                  className="rounded-full bg-[var(--accent)] text-black font-semibold px-6 py-2.5 active:opacity-80"
                >
                  Resume
                </button>
                <button
                  type="button"
                  onClick={onFinish}
                  className="text-xs text-[var(--foreground)] hover:text-[var(--accent)] px-2 py-1"
                >
                  Finish
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onPause}
                  aria-label="Pause"
                  className="size-11 rounded-full border border-[var(--border)] flex items-center justify-center text-[var(--foreground)] hover:border-[var(--accent)]"
                >
                  <PauseIcon className="w-4 h-4" />
                </button>
                <a
                  href={externalDirectionsUrl(destination)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
                >
                  Just take me there ↗
                </a>
                <button
                  type="button"
                  onClick={onFinish}
                  className="rounded-full border border-[var(--accent)]/60 text-[var(--accent)] font-semibold px-5 py-2 hover:bg-[var(--accent)] hover:text-black"
                >
                  Finish
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-[10px] text-[var(--muted)] tabular-nums min-h-4">
          {geoError && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-1.5 rounded-full bg-[var(--accent)]" />
              {geoError === "permission-denied"
                ? "Location permission denied"
                : geoError === "timeout"
                  ? "Slow signal"
                  : "Signal unavailable"}
            </span>
          )}
          {!geoError && !hideNumbers && position?.acc != null && (
            <span>±{Math.round(position.acc)} m</span>
          )}
        </div>
      </div>
    </div>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      className={className}
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      className={className}
      aria-hidden="true"
    >
      <path d="M3 3l18 18" />
      <path d="M10.6 6.1A11.5 11.5 0 0112 6c6.5 0 10 7 10 7a18 18 0 01-3.2 4" />
      <path d="M6.1 6.1A18 18 0 002 13s3.5 7 10 7a11 11 0 005.4-1.4" />
      <path d="M9.5 9.5a3 3 0 004.2 4.2" />
    </svg>
  );
}
