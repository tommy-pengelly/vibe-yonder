"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuthUser } from "./auth";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "./data/settings";
import type { Settings } from "./types";

export type { Settings };

/**
 * Dual-mode settings. hideNumbers + privacy prefs persist to the cloud `settings`
 * table when signed in (so they follow you across devices), and mirror to
 * localStorage for instant/offline reads on the walk. Falls back to localStorage
 * for guests.
 */
export function useSettings() {
  const { user } = useAuthUser();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    void loadSettings().then((s) => {
      if (!cancelled) setSettings(s);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      void saveSettings(next);
      return next;
    });
  }, []);

  return { settings, update };
}
