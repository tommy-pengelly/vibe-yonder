"use client";
import { useCallback, useEffect, useState } from "react";

type OrientationEventWithWebkit = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
};

type IOSDeviceOrientationEvent = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied" | "default">;
};

// A single GLOBAL compass. Listeners attach once, the latest heading lives here,
// and every useHeading() subscribes to it. This is deliberate: iOS only grants
// device-orientation permission from a user GESTURE, but the walk screen (the
// consumer) mounts after a navigation, with no gesture. So the grant + attach
// happen on the launch tap via primeOrientation(), and the walk screen just
// reads the value. Without the singleton the walk's gesture-less request can
// fail and the scope freezes north-up.
let currentHeading: number | null = null;
let attached = false;
const subscribers = new Set<(h: number | null) => void>();

function emit() {
  for (const s of subscribers) s(currentHeading);
}

function onOrientation(raw: Event) {
  const e = raw as OrientationEventWithWebkit;
  let h: number | null = null;
  if (
    typeof e.webkitCompassHeading === "number" &&
    !Number.isNaN(e.webkitCompassHeading)
  ) {
    h = e.webkitCompassHeading; // iOS: degrees clockwise from true north
  } else if (typeof e.alpha === "number" && e.alpha != null) {
    h = (360 - e.alpha) % 360;
  }
  if (h != null && h !== currentHeading) {
    currentHeading = h;
    emit();
  }
}

function attach() {
  if (attached || typeof window === "undefined") return;
  attached = true;
  if ("ondeviceorientationabsolute" in window) {
    window.addEventListener("deviceorientationabsolute", onOrientation, true);
  }
  window.addEventListener("deviceorientation", onOrientation, true);
}

function needsPermission(): boolean {
  if (typeof window === "undefined") return false;
  const D = (window as unknown as { DeviceOrientationEvent?: IOSDeviceOrientationEvent })
    .DeviceOrientationEvent;
  return !!D && typeof D.requestPermission === "function";
}

/**
 * Request compass permission AND attach the global listener. iOS requires this
 * to run inside a user gesture, so call it synchronously from the "start a
 * yonder" tap (see lib usage). Safe to call repeatedly; attaching is idempotent.
 */
export async function primeOrientation(): Promise<void> {
  if (typeof window === "undefined") return;
  const D = (window as unknown as { DeviceOrientationEvent?: IOSDeviceOrientationEvent })
    .DeviceOrientationEvent;
  if (D && typeof D.requestPermission === "function") {
    try {
      const s = await D.requestPermission();
      if (s !== "granted") return;
    } catch {
      return; // denied / not in a gesture; the calibrate prompt is the fallback
    }
  }
  attach();
}

export function useHeading() {
  const [heading, setHeading] = useState<number | null>(currentHeading);

  useEffect(() => {
    subscribers.add(setHeading);
    setHeading(currentHeading);
    // Where no permission gate exists (Android, desktop), attach right away so
    // the scope spins without an explicit prime. iOS waits for primeOrientation
    // (a gesture) and the calibrate prompt.
    if (!needsPermission()) attach();
    return () => {
      subscribers.delete(setHeading);
    };
  }, []);

  // Kept for the calibrate prompt + the start flow: request + attach on a tap.
  const requestAccess = useCallback(async () => {
    await primeOrientation();
    return true;
  }, []);

  return { heading, requestAccess };
}
