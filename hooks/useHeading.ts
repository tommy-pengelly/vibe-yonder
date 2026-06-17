"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type OrientationEventWithWebkit = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
};

type IOSDeviceOrientationEvent = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied" | "default">;
};

// Grab device-orientation (compass) permission while we still have a user
// gesture. On iOS, requestPermission() ONLY works from inside a tap handler, so
// call this synchronously from the "start a yonder" tap. Once granted it stays
// granted, so the walk screen's later requestAccess() (which runs in an effect,
// no gesture) then succeeds and the scope spins. Without this the compass never
// prompts and the scope stays frozen north-up.
export async function primeOrientation(): Promise<void> {
  if (typeof window === "undefined") return;
  const D = (window as unknown as { DeviceOrientationEvent?: IOSDeviceOrientationEvent })
    .DeviceOrientationEvent;
  if (D && typeof D.requestPermission === "function") {
    try {
      await D.requestPermission();
    } catch {
      // denied or unavailable; the in-walk calibrate prompt is the fallback
    }
  }
}

export function useHeading() {
  const [heading, setHeading] = useState<number | null>(null);
  const [supported, setSupported] = useState(true);
  const attached = useRef(false);

  const handler = useCallback((raw: Event) => {
    const e = raw as OrientationEventWithWebkit;
    let h: number | null = null;
    if (
      typeof e.webkitCompassHeading === "number" &&
      !Number.isNaN(e.webkitCompassHeading)
    ) {
      h = e.webkitCompassHeading;
    } else if (typeof e.alpha === "number" && e.alpha != null) {
      h = (360 - e.alpha) % 360;
    }
    if (h != null) setHeading(h);
  }, []);

  const attach = useCallback(() => {
    if (attached.current) return;
    attached.current = true;
    if ("ondeviceorientationabsolute" in window) {
      window.addEventListener("deviceorientationabsolute", handler, true);
    }
    window.addEventListener("deviceorientation", handler, true);
  }, [handler]);

  /** MUST be called from a user gesture (button tap) on iOS. */
  const requestAccess = useCallback(async () => {
    if (typeof window === "undefined") return false;
    const D = (window as unknown as { DeviceOrientationEvent?: IOSDeviceOrientationEvent })
      .DeviceOrientationEvent;
    if (!D) {
      setSupported(false);
      return false;
    }
    if (typeof D.requestPermission === "function") {
      try {
        const s = await D.requestPermission();
        if (s === "granted") {
          attach();
          return true;
        }
        return false;
      } catch {
        return false;
      }
    }
    attach();
    return true;
  }, [attach]);

  useEffect(() => {
    return () => {
      if (typeof window === "undefined") return;
      window.removeEventListener("deviceorientationabsolute", handler, true);
      window.removeEventListener("deviceorientation", handler, true);
      attached.current = false;
    };
  }, [handler]);

  return { heading, supported, requestAccess };
}
