"use client";
// Dual-mode data layer. Every operation branches on auth: when there is a
// signed-in Supabase user we read/write the cloud; otherwise we fall back to
// the synchronous localStorage layer in `./storage`. Callers `await` these
// regardless, so they don't need to know which backend served the request.
import type { SupabaseClient } from "@supabase/supabase-js";
import * as local from "./storage";
import { getSupabase } from "./supabase/client";
import type {
  Destination,
  FavouritePlace,
  Fix,
  SavedYonder,
  StoredList,
  StoredListItem,
  StoredSaved,
  YonderMode,
} from "./types";

type Ctx = { sb: SupabaseClient; uid: string };

/** Cloud context if a Supabase client exists AND there's a signed-in session. */
async function ctx(): Promise<Ctx | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  const uid = data.session?.user?.id;
  return uid ? { sb, uid } : null;
}

// ----- Row <-> model mappers -----

type YonderRow = {
  id: string;
  name: string | null;
  mode: YonderMode | null;
  destinations: Destination[] | null;
  started_at: string | null;
  ended_at: string | null;
  duration_s: number | null;
  distance_m: number | null;
  direct_m: number | null;
  yondered: number | null;
  track: Fix[] | null;
  paused_ms: number | null;
  list_id: string | null;
};

function rowToYonder(r: YonderRow): SavedYonder {
  return {
    id: r.id,
    name: r.name ?? "Yonder",
    mode: r.mode ?? "single",
    destinations: r.destinations ?? [],
    startedAt: r.started_at ? new Date(r.started_at).getTime() : 0,
    endedAt: r.ended_at ? new Date(r.ended_at).getTime() : 0,
    durationMs: (r.duration_s ?? 0) * 1000,
    walked: r.distance_m ?? 0,
    direct: r.direct_m ?? 0,
    yondered: r.yondered ?? 0,
    track: r.track ?? [],
    pausedMs: r.paused_ms ?? 0,
    listId: r.list_id ?? undefined,
  };
}

function yonderToRow(y: SavedYonder, uid: string) {
  return {
    id: y.id,
    user_id: uid,
    name: y.name,
    mode: y.mode,
    destinations: y.destinations,
    started_at: new Date(y.startedAt).toISOString(),
    ended_at: new Date(y.endedAt).toISOString(),
    duration_s: Math.round(y.durationMs / 1000),
    distance_m: y.walked,
    direct_m: y.direct,
    yondered: y.yondered,
    track: y.track,
    paused_ms: y.pausedMs,
    list_id: y.listId ?? null,
  };
}

type PlaceRow = {
  id: string;
  name: string;
  label: string | null;
  lat: number;
  lon: number;
  created_at: string | null;
};

function rowToFavourite(r: PlaceRow): FavouritePlace {
  return {
    id: r.id,
    name: r.name,
    label: r.label ?? undefined,
    lat: r.lat,
    lon: r.lon,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : 0,
  };
}

type ListRow = {
  id: string;
  name: string;
  mode: YonderMode;
  created_at: string | null;
  updated_at: string | null;
};

type ListItemRow = {
  id: string;
  list_id: string;
  name: string;
  label: string | null;
  lat: number;
  lon: number;
  position: number;
  visited: boolean;
  visited_at: string | null;
};

function rowToListItem(r: ListItemRow): StoredListItem {
  return {
    id: r.id,
    name: r.name,
    label: r.label ?? undefined,
    lat: r.lat,
    lon: r.lon,
    visited: r.visited,
    visitedAt: r.visited_at ? new Date(r.visited_at).getTime() : undefined,
  };
}

function rowToList(l: ListRow, items: ListItemRow[]): StoredList {
  return {
    id: l.id,
    name: l.name,
    mode: l.mode,
    items: items.map(rowToListItem),
    createdAt: l.created_at ? new Date(l.created_at).getTime() : 0,
    updatedAt: l.updated_at ? new Date(l.updated_at).getTime() : 0,
  };
}

type SavedRow = {
  id: string;
  kind: "place" | "list";
  ref_id: string;
  name: string;
  lat: number | null;
  lon: number | null;
  created_at: string | null;
};

function rowToSaved(r: SavedRow): StoredSaved {
  return {
    id: r.id,
    kind: r.kind,
    refId: r.ref_id,
    name: r.name,
    lat: r.lat ?? undefined,
    lon: r.lon ?? undefined,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : 0,
  };
}

/** Replace a list's rows in the cloud: upsert the list, then rewrite its items. */
async function writeListCloud(sb: SupabaseClient, uid: string, list: StoredList) {
  await sb.from("lists").upsert({
    id: list.id,
    user_id: uid,
    name: list.name,
    mode: list.mode,
    updated_at: new Date().toISOString(),
  });
  await sb.from("list_items").delete().eq("list_id", list.id);
  if (list.items.length) {
    await sb.from("list_items").insert(
      list.items.map((it, i) => ({
        id: it.id,
        list_id: list.id,
        name: it.name,
        label: it.label ?? null,
        lat: it.lat,
        lon: it.lon,
        position: i,
        visited: it.visited,
        visited_at: it.visitedAt ? new Date(it.visitedAt).toISOString() : null,
      })),
    );
  }
}

// ----- Yonders -----

export async function loadYonders(): Promise<SavedYonder[]> {
  const c = await ctx();
  if (!c) return local.loadYonders();
  const { data, error } = await c.sb
    .from("yonders")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("loadYonders:", error.message);
    return [];
  }
  return (data as YonderRow[]).map(rowToYonder);
}

export async function getYonder(id: string): Promise<SavedYonder | null> {
  const c = await ctx();
  if (!c) return local.getYonder(id);
  const { data, error } = await c.sb
    .from("yonders")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return rowToYonder(data as YonderRow);
}

export async function pushYonder(y: SavedYonder): Promise<void> {
  const c = await ctx();
  if (!c) return local.pushYonder(y);
  const { error } = await c.sb.from("yonders").insert(yonderToRow(y, c.uid));
  if (error) console.error("pushYonder:", error.message);
}

export async function updateYonder(y: SavedYonder): Promise<void> {
  const c = await ctx();
  if (!c) return local.updateYonder(y);
  const { error } = await c.sb
    .from("yonders")
    .update({ name: y.name })
    .eq("id", y.id);
  if (error) console.error("updateYonder:", error.message);
}

export async function deleteYonder(id: string): Promise<void> {
  const c = await ctx();
  if (!c) return local.deleteYonder(id);
  const { error } = await c.sb.from("yonders").delete().eq("id", id);
  if (error) console.error("deleteYonder:", error.message);
}

// ----- Favourites -----

export async function loadFavourites(): Promise<FavouritePlace[]> {
  const c = await ctx();
  if (!c) return local.loadFavourites();
  const { data, error } = await c.sb
    .from("places")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("loadFavourites:", error.message);
    return [];
  }
  return (data as PlaceRow[]).map(rowToFavourite);
}

export async function pushFavourite(
  p: Omit<FavouritePlace, "id" | "createdAt">,
): Promise<FavouritePlace> {
  const c = await ctx();
  if (!c) return local.pushFavourite(p);
  // Dedupe on coordinates + name, mirroring the localStorage behaviour.
  const { data: existing } = await c.sb
    .from("places")
    .select("*")
    .eq("name", p.name)
    .gte("lat", p.lat - 1e-6)
    .lte("lat", p.lat + 1e-6)
    .gte("lon", p.lon - 1e-6)
    .lte("lon", p.lon + 1e-6)
    .maybeSingle();
  if (existing) return rowToFavourite(existing as PlaceRow);
  const id = crypto.randomUUID();
  const { data, error } = await c.sb
    .from("places")
    .insert({
      id,
      user_id: c.uid,
      name: p.name,
      label: p.label ?? null,
      lat: p.lat,
      lon: p.lon,
    })
    .select("*")
    .single();
  if (error || !data) {
    return { ...p, id, createdAt: Date.now() };
  }
  return rowToFavourite(data as PlaceRow);
}

export async function removeFavourite(id: string): Promise<void> {
  const c = await ctx();
  if (!c) return local.removeFavourite(id);
  const { error } = await c.sb.from("places").delete().eq("id", id);
  if (error) console.error("removeFavourite:", error.message);
}

export async function isFavourite(
  lat: number,
  lon: number,
  name: string,
): Promise<boolean> {
  const c = await ctx();
  if (!c) return local.isFavourite(lat, lon, name);
  const { data } = await c.sb
    .from("places")
    .select("id")
    .eq("name", name)
    .gte("lat", lat - 1e-6)
    .lte("lat", lat + 1e-6)
    .gte("lon", lon - 1e-6)
    .lte("lon", lon + 1e-6)
    .maybeSingle();
  return Boolean(data);
}

// ----- Lists -----

export async function loadLists(): Promise<StoredList[]> {
  const c = await ctx();
  if (!c) return local.loadLists();
  const { data: lists, error } = await c.sb
    .from("lists")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) {
    console.error("loadLists:", error.message);
    return [];
  }
  const rows = lists as ListRow[];
  if (rows.length === 0) return [];
  const { data: items } = await c.sb
    .from("list_items")
    .select("*")
    .in(
      "list_id",
      rows.map((l) => l.id),
    )
    .order("position", { ascending: true });
  const byList = new Map<string, ListItemRow[]>();
  for (const it of (items as ListItemRow[]) ?? []) {
    const arr = byList.get(it.list_id) ?? [];
    arr.push(it);
    byList.set(it.list_id, arr);
  }
  return rows.map((l) => rowToList(l, byList.get(l.id) ?? []));
}

export async function getList(id: string): Promise<StoredList | null> {
  const c = await ctx();
  if (!c) return local.getList(id);
  const { data: list, error } = await c.sb
    .from("lists")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !list) return null;
  const { data: items } = await c.sb
    .from("list_items")
    .select("*")
    .eq("list_id", id)
    .order("position", { ascending: true });
  return rowToList(list as ListRow, (items as ListItemRow[]) ?? []);
}

export async function saveList(list: StoredList): Promise<void> {
  const c = await ctx();
  if (!c) return local.saveList(list);
  await writeListCloud(c.sb, c.uid, list);
}

export async function deleteList(id: string): Promise<void> {
  const c = await ctx();
  if (!c) return local.deleteList(id);
  // list_items cascade on the FK, so deleting the list is enough.
  const { error } = await c.sb.from("lists").delete().eq("id", id);
  if (error) console.error("deleteList:", error.message);
}

// ----- Saved (save-for-later) -----

export async function loadSaved(): Promise<StoredSaved[]> {
  const c = await ctx();
  if (!c) return local.loadSaved();
  const { data, error } = await c.sb
    .from("saved")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("loadSaved:", error.message);
    return [];
  }
  return (data as SavedRow[]).map(rowToSaved);
}

export async function pushSaved(
  s: Omit<StoredSaved, "id" | "createdAt">,
): Promise<StoredSaved> {
  const c = await ctx();
  if (!c) return local.pushSaved(s);
  const id = crypto.randomUUID();
  const { data, error } = await c.sb
    .from("saved")
    .insert({
      id,
      user_id: c.uid,
      kind: s.kind,
      ref_id: s.refId,
      name: s.name,
      lat: s.lat ?? null,
      lon: s.lon ?? null,
    })
    .select("*")
    .single();
  if (error || !data) {
    return { ...s, id, createdAt: Date.now() };
  }
  return rowToSaved(data as SavedRow);
}

export async function removeSaved(id: string): Promise<void> {
  const c = await ctx();
  if (!c) return local.removeSaved(id);
  const { error } = await c.sb.from("saved").delete().eq("id", id);
  if (error) console.error("removeSaved:", error.message);
}

// ----- Guest -> account import -----

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
  const lists = local.loadLists();
  const saved = local.loadSaved();
  if (
    yonders.length === 0 &&
    favourites.length === 0 &&
    lists.length === 0 &&
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
    for (const l of lists) {
      await writeListCloud(c.sb, c.uid, l);
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
