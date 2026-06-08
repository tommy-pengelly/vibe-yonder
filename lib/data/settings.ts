"use client";
import type { Settings } from "../types";
import { ctx, type Ctx } from "./ctx";

const KEY = "vibe-yonder.settings.v1";

export const DEFAULT_SETTINGS: Settings = {
  hideNumbers: false,
  defaultVisibility: "private",
  privacyZone: null,
};

function readLocal(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    // ignore corrupt state
  }
  return DEFAULT_SETTINGS;
}

function writeLocal(s: Settings) {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // quota / privacy mode
  }
}

type Row = {
  hide_numbers: boolean;
  default_visibility: Settings["defaultVisibility"];
  privacy_zone_lat: number | null;
  privacy_zone_lon: number | null;
  privacy_zone_radius_m: number;
};

function rowToSettings(r: Row): Settings {
  return {
    hideNumbers: r.hide_numbers,
    defaultVisibility: r.default_visibility,
    privacyZone:
      r.privacy_zone_lat != null && r.privacy_zone_lon != null
        ? { lat: r.privacy_zone_lat, lon: r.privacy_zone_lon, radiusM: r.privacy_zone_radius_m }
        : null,
  };
}

async function saveCloud(c: Ctx, s: Settings) {
  await c.sb.from("settings").upsert({
    user_id: c.uid,
    hide_numbers: s.hideNumbers,
    default_visibility: s.defaultVisibility,
    privacy_zone_lat: s.privacyZone?.lat ?? null,
    privacy_zone_lon: s.privacyZone?.lon ?? null,
    privacy_zone_radius_m: s.privacyZone?.radiusM ?? 200,
    updated_at: new Date().toISOString(),
  });
}

export async function loadSettings(): Promise<Settings> {
  const c = await ctx();
  if (!c) return readLocal();
  const { data } = await c.sb.from("settings").select("*").eq("user_id", c.uid).maybeSingle();
  if (!data) {
    // First cloud load — carry the guest's local prefs (hideNumbers) forward.
    const local = readLocal();
    await saveCloud(c, local);
    return local;
  }
  const s = rowToSettings(data as Row);
  writeLocal(s); // mirror locally for instant/offline reads on the walk
  return s;
}

export async function saveSettings(next: Settings): Promise<void> {
  writeLocal(next);
  const c = await ctx();
  if (c) await saveCloud(c, next);
}
