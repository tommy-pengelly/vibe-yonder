"use client";
import * as local from "../storage";
import type { FavouritePlace } from "../types";
import { ctx } from "./ctx";

export type PlaceRow = {
  id: string;
  name: string;
  label: string | null;
  lat: number;
  lon: number;
  created_at: string | null;
  alias?: string | null;
};

export function rowToFavourite(r: PlaceRow): FavouritePlace {
  return {
    id: r.id,
    name: r.name,
    label: r.label ?? undefined,
    lat: r.lat,
    lon: r.lon,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : 0,
    alias: r.alias ?? undefined,
  };
}

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
  const existing = await getFavourite(p.lat, p.lon, p.name);
  if (existing) return existing;
  const id = crypto.randomUUID();
  const { data, error } = await c.sb
    .from("places")
    .insert({ id, user_id: c.uid, name: p.name, label: p.label ?? null, lat: p.lat, lon: p.lon })
    .select("*")
    .single();
  if (error || !data) return { ...p, id, createdAt: Date.now() };
  return rowToFavourite(data as PlaceRow);
}

export async function removeFavourite(id: string): Promise<void> {
  const c = await ctx();
  if (!c) return local.removeFavourite(id);
  const { error } = await c.sb.from("places").delete().eq("id", id);
  if (error) console.error("removeFavourite:", error.message);
}

/** Set a favourite's personal alias ("Home", "Work", …). */
export async function setFavouriteAlias(
  id: string,
  alias: string,
): Promise<void> {
  const c = await ctx();
  if (!c) return local.updateFavourite(id, { alias: alias || undefined });
  // alias is a newer column (migration 0012); best-effort so it self-heals.
  const { error } = await c.sb
    .from("places")
    .update({ alias: alias || null })
    .eq("id", id);
  if (error) {
    console.warn("setFavouriteAlias (apply migration 0012?):", error.message);
  }
}

export async function isFavourite(lat: number, lon: number, name: string): Promise<boolean> {
  return (await getFavourite(lat, lon, name)) != null;
}

export async function getFavourite(
  lat: number,
  lon: number,
  name: string,
): Promise<FavouritePlace | null> {
  const c = await ctx();
  if (!c) return local.getFavourite(lat, lon, name);
  const { data } = await c.sb
    .from("places")
    .select("*")
    .eq("name", name)
    .gte("lat", lat - 1e-6)
    .lte("lat", lat + 1e-6)
    .gte("lon", lon - 1e-6)
    .lte("lon", lon + 1e-6)
    .maybeSingle();
  return data ? rowToFavourite(data as PlaceRow) : null;
}
