"use client";
import * as local from "../storage";
import type { Destination, Fix, SavedYonder, YonderMode } from "../types";
import { ctx } from "./ctx";

export type YonderRow = {
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
  map_id: string | null;
};

export function rowToYonder(r: YonderRow): SavedYonder {
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
    mapId: r.map_id ?? undefined,
  };
}

export function yonderToRow(y: SavedYonder, uid: string) {
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
    map_id: y.mapId ?? null,
  };
}

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
  const { error } = await c.sb.from("yonders").update({ name: y.name }).eq("id", y.id);
  if (error) console.error("updateYonder:", error.message);
}

export async function deleteYonder(id: string): Promise<void> {
  const c = await ctx();
  if (!c) return local.deleteYonder(id);
  const { error } = await c.sb.from("yonders").delete().eq("id", id);
  if (error) console.error("deleteYonder:", error.message);
}
