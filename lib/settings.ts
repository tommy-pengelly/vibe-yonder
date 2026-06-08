"use client";
import { useCallback, useEffect, useState } from "react";

const KEY = "vibe-yonder.settings.v1";

export type Settings = {
  hideNumbers: boolean;
};

const DEFAULT: Settings = {
  hideNumbers: false,
};

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Settings>;
        setSettings({ ...DEFAULT, ...parsed });
      }
    } catch {
      // ignore corrupt persisted state
    }
  }, []);

  const update = useCallback((next: Partial<Settings>) => {
    setSettings((s) => {
      const merged = { ...s, ...next };
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(KEY, JSON.stringify(merged));
        }
      } catch {}
      return merged;
    });
  }, []);

  return { settings, update };
}
