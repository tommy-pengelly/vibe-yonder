"use client";
import { useMemo, useRef } from "react";
import { bearing, fmtDist, haversine, makeAngleSmoother } from "@/lib/geo";
import type { Destination, Fix } from "@/lib/types";

type Props = {
  destination: Destination;
  position: Fix | null;
  heading: number | null;
  headingAvailable: boolean;
  geoError: string | null;
  onFinish: () => void;
  onCancel: () => void;
};

const ARRIVAL_RADIUS_M = 25;

export default function Compass({
  destination,
  position,
  heading,
  headingAvailable,
  geoError,
  onFinish,
  onCancel,
}: Props) {
  const ringSmoother = useRef(makeAngleSmoother());
  const needleSmoother = useRef(makeAngleSmoother());

  const dist =
    position &&
    haversine(position.lat, position.lon, destination.lat, destination.lon);
  const brg =
    position &&
    bearing(position.lat, position.lon, destination.lat, destination.lon);

  const ringRotation = useMemo(() => {
    if (heading == null) return ringSmoother.current(0);
    return ringSmoother.current(-heading);
  }, [heading]);

  const needleRotation = useMemo(() => {
    if (brg == null) return null;
    const target = heading == null ? brg : brg - heading;
    return needleSmoother.current(target);
  }, [brg, heading]);

  const arrived = dist != null && dist < ARRIVAL_RADIUS_M;

  return (
    <div className="flex-1 flex flex-col w-full max-w-md mx-auto px-5 pt-6 pb-8 gap-6">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col min-w-0">
          <span className="text-xs uppercase tracking-wider text-[var(--muted)]">
            Heading to
          </span>
          <h1 className="text-xl font-semibold truncate">{destination.name}</h1>
          {destination.label && destination.label !== destination.name && (
            <p className="text-xs text-[var(--muted)] truncate mt-0.5">
              {destination.label}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] shrink-0 mt-1"
        >
          Cancel
        </button>
      </header>

      <div className="flex-1 flex items-center justify-center">
        <div className="relative w-[min(82vw,360px)] aspect-square">
          <div
            className="absolute inset-0 rounded-full border border-[var(--border)] transition-transform duration-300 ease-out"
            style={{ transform: `rotate(${ringRotation}deg)` }}
          >
            {(
              [
                { label: "N", angle: 0, accent: true },
                { label: "E", angle: 90, accent: false },
                { label: "S", angle: 180, accent: false },
                { label: "W", angle: 270, accent: false },
              ] as const
            ).map(({ label, angle, accent }) => (
              <div
                key={label}
                className="absolute inset-0 pointer-events-none"
                style={{ transform: `rotate(${angle}deg)` }}
              >
                <span
                  className={`absolute left-1/2 top-2 -translate-x-1/2 text-xs tracking-widest ${
                    accent
                      ? "text-[var(--accent)] font-semibold"
                      : "text-[var(--muted)]"
                  }`}
                  style={{ transform: `translateX(-50%) rotate(${-angle}deg)` }}
                >
                  {label}
                </span>
              </div>
            ))}
            <div className="absolute left-1/2 top-1 -translate-x-1/2 w-px h-3 bg-[var(--accent)]" />
          </div>

          {needleRotation != null ? (
            <div
              className="absolute inset-0 flex items-center justify-center transition-transform duration-200 ease-out"
              style={{
                transform: `rotate(${needleRotation}deg)`,
                opacity: headingAvailable ? 1 : 0.45,
              }}
            >
              <svg
                viewBox="0 0 100 100"
                className="w-2/3 h-2/3"
                aria-hidden="true"
              >
                <polygon
                  points="50,8 60,55 50,48 40,55"
                  fill="var(--accent)"
                />
                <circle cx="50" cy="50" r="3" fill="var(--foreground)" />
              </svg>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-[var(--muted)]">
              Acquiring location…
            </div>
          )}

          <div className="absolute left-1/2 -translate-x-1/2 bottom-6 text-center pointer-events-none">
            <div className="text-3xl font-semibold tabular-nums">
              {arrived
                ? "Arrived"
                : dist != null
                  ? fmtDist(dist)
                  : "—"}
            </div>
            {!arrived && brg != null && (
              <div className="text-xs text-[var(--muted)] tabular-nums mt-1">
                bearing {Math.round(brg)}°
                {heading != null && (
                  <> · heading {Math.round(heading)}°</>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 items-center text-xs text-[var(--muted)] text-center">
        {!headingAvailable && (
          <p>
            No compass signal — needle shows true bearing only. Hold the phone
            flat and point the top forward, or wave it in a figure-8 to
            calibrate.
          </p>
        )}
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
        {position?.acc != null && (
          <p>GPS accuracy ±{Math.round(position.acc)} m</p>
        )}
      </div>

      <button
        type="button"
        onClick={onFinish}
        className="w-full rounded-xl bg-[var(--accent)] text-black font-semibold py-3 active:opacity-80 transition-opacity"
      >
        {arrived ? "Finish walk" : "Finish"}
      </button>
    </div>
  );
}
