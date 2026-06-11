"use client";
import { getSupabase } from "../supabase/client";
import type { LatLon, Medal } from "../types";
import { ctx } from "./ctx";

export type Mission = {
  id: string;
  userId: string;
  name: string | null;
  a: LatLon;
  b: LatLon;
  distanceM: number;
  createdAt: number;
  who?: string; // @handle of creator
  attempts?: number;
  mine?: boolean; // created by the current user (vs one they're racing on)
};

export type LeaderRow = {
  userId: string;
  who: string;
  handle: string;
  maxDeviation: number;
  avgDeviation: number;
  medal: Medal;
  isMe: boolean;
};

type MissionRow = {
  id: string;
  user_id: string;
  name: string | null;
  a_lat: number;
  a_lon: number;
  b_lat: number;
  b_lon: number;
  distance_m: number | null;
  created_at: string | null;
};

function rowToMission(r: MissionRow, who?: string, attempts?: number): Mission {
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    a: { lat: r.a_lat, lon: r.a_lon },
    b: { lat: r.b_lat, lon: r.b_lon },
    distanceM: r.distance_m ?? 0,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : 0,
    who,
    attempts,
  };
}

async function handlesFor(ids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const sb = getSupabase();
  if (!sb || ids.length === 0) return out;
  const { data } = await sb
    .from("profiles")
    .select("id,username")
    .in("id", [...new Set(ids)]);
  for (const p of (data as { id: string; username: string | null }[]) ?? []) {
    out[p.id] = p.username ?? "wanderer";
  }
  return out;
}

/** Create a mission from a walked straight line. Needs an account. */
export async function createMission(opts: {
  name?: string;
  a: LatLon;
  b: LatLon;
  distanceM: number;
}): Promise<string | null> {
  const c = await ctx();
  if (!c) return null;
  const id = crypto.randomUUID();
  const { error } = await c.sb.from("missions").insert({
    id,
    user_id: c.uid,
    name: opts.name ?? null,
    a_lat: opts.a.lat,
    a_lon: opts.a.lon,
    b_lat: opts.b.lat,
    b_lon: opts.b.lon,
    distance_m: opts.distanceM,
  });
  if (error) {
    console.warn("createMission:", error.message);
    return null;
  }
  // Post it flat to the community feed (kind 'mission' → ref_id = mission id).
  const { error: postErr } = await c.sb.from("posts").insert({
    user_id: c.uid,
    kind: "mission",
    ref_id: id,
    visibility: "public",
    payload: { name: opts.name ?? null, distance_m: opts.distanceM },
  });
  if (postErr) console.warn("createMission post:", postErr.message);
  return id;
}

/** Missions in the user's world: ones they made, plus ones they're racing on
 * (have an attempt against). `mine` flags the ones they created. */
export async function loadMyMissions(): Promise<Mission[]> {
  const c = await ctx();
  if (!c) return [];
  const [createdRes, attRes] = await Promise.all([
    c.sb
      .from("missions")
      .select("*")
      .eq("user_id", c.uid)
      .order("created_at", { ascending: false })
      .limit(50),
    c.sb.from("mission_attempts").select("mission_id").eq("user_id", c.uid),
  ]);
  const createdRows = (createdRes.data as MissionRow[]) ?? [];
  const mineIds = new Set(createdRows.map((r) => r.id));
  const attIds = [
    ...new Set(((attRes.data as { mission_id: string }[]) ?? []).map((a) => a.mission_id)),
  ].filter((id) => !mineIds.has(id));

  let attemptedRows: MissionRow[] = [];
  if (attIds.length > 0) {
    const { data } = await c.sb.from("missions").select("*").in("id", attIds).limit(50);
    attemptedRows = (data as MissionRow[]) ?? [];
  }

  const rows = [...createdRows, ...attemptedRows];
  if (rows.length === 0) return [];

  const handles = await handlesFor(rows.map((r) => r.user_id));
  const { data: counts } = await c.sb
    .from("mission_attempts")
    .select("mission_id")
    .in(
      "mission_id",
      rows.map((r) => r.id),
    );
  const tally: Record<string, number> = {};
  for (const a of (counts as { mission_id: string }[]) ?? [])
    tally[a.mission_id] = (tally[a.mission_id] ?? 0) + 1;

  return rows
    .map((r) => ({
      ...rowToMission(r, `@${handles[r.user_id] ?? "wanderer"}`, tally[r.id] ?? 0),
      mine: mineIds.has(r.id),
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function loadMissions(): Promise<Mission[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from("missions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  const rows = (data as MissionRow[]) ?? [];
  if (rows.length === 0) return [];
  const handles = await handlesFor(rows.map((r) => r.user_id));
  // Attempt counts per mission.
  const { data: counts } = await sb
    .from("mission_attempts")
    .select("mission_id")
    .in("mission_id", rows.map((r) => r.id));
  const tally: Record<string, number> = {};
  for (const a of (counts as { mission_id: string }[]) ?? [])
    tally[a.mission_id] = (tally[a.mission_id] ?? 0) + 1;
  return rows.map((r) =>
    rowToMission(r, `@${handles[r.user_id] ?? "wanderer"}`, tally[r.id] ?? 0),
  );
}

export async function getMission(id: string): Promise<Mission | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.from("missions").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const r = data as MissionRow;
  const handles = await handlesFor([r.user_id]);
  return rowToMission(r, `@${handles[r.user_id] ?? "wanderer"}`);
}

/** Record an attempt, keep only the user's best (lowest max, then avg). */
export async function recordAttempt(
  missionId: string,
  s: { maxDeviation: number; avgDeviation: number; inCorridorPct: number; medal: Medal },
): Promise<void> {
  const c = await ctx();
  if (!c) return;
  const { data: existing } = await c.sb
    .from("mission_attempts")
    .select("max_deviation,avg_deviation")
    .eq("mission_id", missionId)
    .eq("user_id", c.uid)
    .maybeSingle();
  const prev = existing as { max_deviation: number; avg_deviation: number } | null;
  const better =
    !prev ||
    s.maxDeviation < prev.max_deviation ||
    (s.maxDeviation === prev.max_deviation && s.avgDeviation < prev.avg_deviation);
  if (!better) return;
  const { error } = await c.sb.from("mission_attempts").upsert(
    {
      mission_id: missionId,
      user_id: c.uid,
      max_deviation: s.maxDeviation,
      avg_deviation: s.avgDeviation,
      in_corridor_pct: s.inCorridorPct,
      medal: s.medal,
    },
    { onConflict: "mission_id,user_id" },
  );
  if (error) console.warn("recordAttempt:", error.message);
}

export async function loadLeaderboard(missionId: string): Promise<LeaderRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from("mission_attempts")
    .select("user_id,max_deviation,avg_deviation,medal")
    .eq("mission_id", missionId)
    .order("max_deviation", { ascending: true })
    .order("avg_deviation", { ascending: true })
    .limit(100);
  const rows =
    (data as {
      user_id: string;
      max_deviation: number;
      avg_deviation: number;
      medal: Medal | null;
    }[]) ?? [];
  if (rows.length === 0) return [];
  const handles = await handlesFor(rows.map((r) => r.user_id));
  const { data: sess } = await sb.auth.getSession();
  const me = sess.session?.user?.id;
  return rows.map((r) => ({
    userId: r.user_id,
    who: `@${handles[r.user_id] ?? "wanderer"}`,
    handle: `@${handles[r.user_id] ?? "wanderer"}`,
    maxDeviation: r.max_deviation,
    avgDeviation: r.avg_deviation,
    medal: r.medal ?? "none",
    isMe: !!me && me === r.user_id,
  }));
}
