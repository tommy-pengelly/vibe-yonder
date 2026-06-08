"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as local from "../storage";
import type { StoredMap, StoredMapItem, YonderMode } from "../types";
import { ctx } from "./ctx";

export type MapRow = {
  id: string;
  name: string;
  mode: YonderMode;
  created_at: string | null;
  updated_at: string | null;
};

export type MapItemRow = {
  id: string;
  map_id: string;
  name: string;
  label: string | null;
  lat: number;
  lon: number;
  position: number;
  visited: boolean;
  visited_at: string | null;
};

export function rowToMapItem(r: MapItemRow): StoredMapItem {
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

export function rowToMap(m: MapRow, items: MapItemRow[]): StoredMap {
  return {
    id: m.id,
    name: m.name,
    mode: m.mode,
    items: items.map(rowToMapItem),
    createdAt: m.created_at ? new Date(m.created_at).getTime() : 0,
    updatedAt: m.updated_at ? new Date(m.updated_at).getTime() : 0,
  };
}

/** Replace a map's rows in the cloud: upsert the map, then rewrite its items. */
export async function writeMapCloud(sb: SupabaseClient, uid: string, map: StoredMap) {
  await sb.from("maps").upsert({
    id: map.id,
    user_id: uid,
    name: map.name,
    mode: map.mode,
    updated_at: new Date().toISOString(),
  });
  await sb.from("map_items").delete().eq("map_id", map.id);
  if (map.items.length) {
    await sb.from("map_items").insert(
      map.items.map((it, i) => ({
        id: it.id,
        map_id: map.id,
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

export async function loadMaps(): Promise<StoredMap[]> {
  const c = await ctx();
  if (!c) return local.loadMaps();
  const { data: maps, error } = await c.sb
    .from("maps")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) {
    console.error("loadMaps:", error.message);
    return [];
  }
  const rows = maps as MapRow[];
  if (rows.length === 0) return [];
  const { data: items } = await c.sb
    .from("map_items")
    .select("*")
    .in("map_id", rows.map((m) => m.id))
    .order("position", { ascending: true });
  const byMap = new Map<string, MapItemRow[]>();
  for (const it of (items as MapItemRow[]) ?? []) {
    const arr = byMap.get(it.map_id) ?? [];
    arr.push(it);
    byMap.set(it.map_id, arr);
  }
  return rows.map((m) => rowToMap(m, byMap.get(m.id) ?? []));
}

export async function getMap(id: string): Promise<StoredMap | null> {
  const c = await ctx();
  if (!c) return local.getMap(id);
  const { data: map, error } = await c.sb
    .from("maps")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !map) return null;
  const { data: items } = await c.sb
    .from("map_items")
    .select("*")
    .eq("map_id", id)
    .order("position", { ascending: true });
  return rowToMap(map as MapRow, (items as MapItemRow[]) ?? []);
}

export async function saveMap(map: StoredMap): Promise<void> {
  const c = await ctx();
  if (!c) return local.saveMap(map);
  await writeMapCloud(c.sb, c.uid, map);
}

export async function deleteMap(id: string): Promise<void> {
  const c = await ctx();
  if (!c) return local.deleteMap(id);
  // map_items cascade on the FK, so deleting the map is enough.
  const { error } = await c.sb.from("maps").delete().eq("id", id);
  if (error) console.error("deleteMap:", error.message);
}
