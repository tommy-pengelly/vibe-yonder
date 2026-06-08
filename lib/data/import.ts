"use client";
import * as local from "../storage";
import { ctx } from "./ctx";
import { writeMapCloud } from "./maps";
import { yonderToRow } from "./yonders";

// Guards the import so the many `useAuthUser` callers that fire it on sign-in
// only run it once per app session. Reset on failure so a later attempt retries.
let importStarted = false;

/**
 * Copy everything the guest accumulated in localStorage into the signed-in
 * user's cloud account, then clear the local copies. A no-op when there's no
 * cloud session or nothing to import. Only clears local on success, so a failed
 * import leaves guest data intact to retry.
 */
export async function importGuestData(): Promise<void> {
  if (importStarted) return;
  const c = await ctx();
  if (!c) return;
  importStarted = true;
  const yonders = local.loadYonders();
  const favourites = local.loadFavourites();
  const maps = local.loadMaps();
  const saved = local.loadSaved();
  if (
    yonders.length === 0 &&
    favourites.length === 0 &&
    maps.length === 0 &&
    saved.length === 0
  ) {
    return;
  }
  try {
    if (yonders.length) {
      const { error } = await c.sb
        .from("yonders")
        .insert(yonders.map((y) => yonderToRow(y, c.uid)));
      if (error) throw error;
    }
    if (favourites.length) {
      const { error } = await c.sb.from("places").insert(
        favourites.map((f) => ({
          id: f.id,
          user_id: c.uid,
          name: f.name,
          label: f.label ?? null,
          lat: f.lat,
          lon: f.lon,
        })),
      );
      if (error) throw error;
    }
    for (const m of maps) {
      await writeMapCloud(c.sb, c.uid, m);
    }
    if (saved.length) {
      const { error } = await c.sb.from("saved").insert(
        saved.map((s) => ({
          id: s.id,
          user_id: c.uid,
          kind: s.kind,
          ref_id: s.refId,
          name: s.name,
          lat: s.lat ?? null,
          lon: s.lon ?? null,
        })),
      );
      if (error) throw error;
    }
    local.clearGuestData();
  } catch (e) {
    console.error("Guest import failed; keeping local copies.", e);
    importStarted = false; // allow a later sign-in/visit to retry
  }
}
