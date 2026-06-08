"use client";
import * as local from "../storage";
import type { StoredSaved } from "../types";
import { ctx } from "./ctx";

export type SavedRow = {
  id: string;
  kind: "place" | "map";
  ref_id: string;
  name: string;
  lat: number | null;
  lon: number | null;
  created_at: string | null;
};

export function rowToSaved(r: SavedRow): StoredSaved {
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
  if (error || !data) return { ...s, id, createdAt: Date.now() };
  return rowToSaved(data as SavedRow);
}

export async function removeSaved(id: string): Promise<void> {
  const c = await ctx();
  if (!c) return local.removeSaved(id);
  const { error } = await c.sb.from("saved").delete().eq("id", id);
  if (error) console.error("removeSaved:", error.message);
}
