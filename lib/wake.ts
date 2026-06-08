type WakeLockSentinel = {
  release: () => Promise<void>;
};

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinel>;
  };
};

let lock: WakeLockSentinel | null = null;

export async function keepAwake(on: boolean): Promise<void> {
  if (typeof navigator === "undefined") return;
  const nav = navigator as NavigatorWithWakeLock;
  try {
    if (on) {
      if (!nav.wakeLock) return;
      if (lock) return;
      lock = await nav.wakeLock.request("screen");
    } else if (lock) {
      const released = lock;
      lock = null;
      await released.release();
    }
  } catch {
    // Wake lock can be refused (battery saver, etc.). Silently ignore.
  }
}

export function isWakeHeld() {
  return lock !== null;
}
