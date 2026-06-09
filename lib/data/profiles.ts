"use client";
import { getSupabase } from "../supabase/client";
import type { Profile } from "../types";
import { ctx } from "./ctx";

type ProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_private: boolean;
};

function rowToProfile(r: ProfileRow): Profile {
  return {
    id: r.id,
    username: r.username ?? "wanderer",
    displayName: r.display_name ?? undefined,
    bio: r.bio ?? undefined,
    avatarUrl: r.avatar_url ?? undefined,
    isPrivate: r.is_private,
  };
}

/** Profiles are public-readable, so a plain client (no session) is fine. */
export async function getProfileByUsername(username: string): Promise<Profile | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.from("profiles").select("*").eq("username", username).maybeSingle();
  return data ? rowToProfile(data as ProfileRow) : null;
}

export async function getProfileById(id: string): Promise<Profile | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.from("profiles").select("*").eq("id", id).maybeSingle();
  return data ? rowToProfile(data as ProfileRow) : null;
}

export async function getProfilesByIds(ids: string[]): Promise<Profile[]> {
  const sb = getSupabase();
  if (!sb || ids.length === 0) return [];
  const { data } = await sb.from("profiles").select("*").in("id", [...new Set(ids)]);
  return ((data as ProfileRow[]) ?? []).map(rowToProfile);
}

/** Search explorers by username or display name (profiles are public-read). */
export async function searchProfiles(q: string): Promise<Profile[]> {
  const term = q.trim().replace(/[%,()]/g, "");
  if (term.length < 2) return [];
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from("profiles")
    .select("*")
    .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
    .limit(20);
  return ((data as ProfileRow[]) ?? []).map(rowToProfile);
}

export async function getMyProfile(): Promise<Profile | null> {
  const c = await ctx();
  if (!c) return null;
  const { data } = await c.sb.from("profiles").select("*").eq("id", c.uid).maybeSingle();
  return data ? rowToProfile(data as ProfileRow) : null;
}

export async function updateProfile(patch: {
  username?: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  isPrivate?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Not signed in." };
  const row: Record<string, unknown> = {};
  if (patch.username !== undefined) row.username = patch.username.trim().toLowerCase();
  if (patch.displayName !== undefined) row.display_name = patch.displayName.trim() || null;
  if (patch.bio !== undefined) row.bio = patch.bio.trim() || null;
  if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl || null;
  if (patch.isPrivate !== undefined) row.is_private = patch.isPrivate;
  const { error } = await c.sb.from("profiles").update(row).eq("id", c.uid);
  if (error) {
    return { ok: false, error: error.code === "23505" ? "That username is taken." : error.message };
  }
  return { ok: true };
}
