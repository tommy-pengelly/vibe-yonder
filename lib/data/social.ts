"use client";
import { getSupabase } from "../supabase/client";
import type { FollowCounts, Profile } from "../types";
import { ctx } from "./ctx";
import { getProfileById, getProfilesByIds } from "./profiles";

type Subject = "yonder" | "map";

// ----- Follows -----

export type FollowState = "none" | "pending" | "accepted";

/** Follow. Private accounts get a pending request; public accounts accept now. */
export async function follow(userId: string): Promise<FollowState> {
  const c = await ctx();
  if (!c || c.uid === userId) return "none";
  const target = await getProfileById(userId);
  const status: FollowState = target?.isPrivate ? "pending" : "accepted";
  await c.sb.from("follows").upsert({ follower_id: c.uid, following_id: userId, status });
  return status;
}

export async function followState(userId: string): Promise<FollowState> {
  const c = await ctx();
  if (!c) return "none";
  const { data } = await c.sb
    .from("follows")
    .select("status")
    .eq("follower_id", c.uid)
    .eq("following_id", userId)
    .maybeSingle();
  return (data as { status: FollowState } | null)?.status ?? "none";
}

export async function listFollowers(userId: string): Promise<Profile[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from("follows")
    .select("follower_id")
    .eq("following_id", userId)
    .eq("status", "accepted");
  return getProfilesByIds((data as { follower_id: string }[] | null)?.map((f) => f.follower_id) ?? []);
}

export async function listFollowing(userId: string): Promise<Profile[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId)
    .eq("status", "accepted");
  return getProfilesByIds((data as { following_id: string }[] | null)?.map((f) => f.following_id) ?? []);
}

/** Pending follow requests awaiting MY approval (I'm the following_id). */
export async function listFollowRequests(): Promise<Profile[]> {
  const c = await ctx();
  if (!c) return [];
  const { data } = await c.sb
    .from("follows")
    .select("follower_id")
    .eq("following_id", c.uid)
    .eq("status", "pending");
  return getProfilesByIds((data as { follower_id: string }[] | null)?.map((f) => f.follower_id) ?? []);
}

export async function acceptFollowRequest(followerId: string): Promise<void> {
  const c = await ctx();
  if (!c) return;
  await c.sb
    .from("follows")
    .update({ status: "accepted" })
    .eq("follower_id", followerId)
    .eq("following_id", c.uid);
}

export async function rejectFollowRequest(followerId: string): Promise<void> {
  const c = await ctx();
  if (!c) return;
  await c.sb.from("follows").delete().eq("follower_id", followerId).eq("following_id", c.uid);
}

export async function unfollow(userId: string): Promise<void> {
  const c = await ctx();
  if (!c) return;
  await c.sb.from("follows").delete().eq("follower_id", c.uid).eq("following_id", userId);
}

export async function isFollowing(userId: string): Promise<boolean> {
  const c = await ctx();
  if (!c) return false;
  const { data } = await c.sb
    .from("follows")
    .select("following_id")
    .eq("follower_id", c.uid)
    .eq("following_id", userId)
    .maybeSingle();
  return Boolean(data);
}

export async function followCounts(userId: string): Promise<FollowCounts> {
  const sb = getSupabase();
  if (!sb) return { followers: 0, following: 0 };
  const followers = await sb
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("following_id", userId)
    .eq("status", "accepted");
  const following = await sb
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("follower_id", userId)
    .eq("status", "accepted");
  return { followers: followers.count ?? 0, following: following.count ?? 0 };
}

// ----- Grubs (kudos) -----

/** Grub counts + viewer-grubbed flags for a batch of subjects of one type. */
export async function grubCountsFor(
  subjectType: Subject,
  ids: string[],
): Promise<Record<string, { count: number; grubbed: boolean }>> {
  const out: Record<string, { count: number; grubbed: boolean }> = {};
  ids.forEach((id) => (out[id] = { count: 0, grubbed: false }));
  const sb = getSupabase();
  if (!sb || ids.length === 0) return out;
  const { data: sess } = await sb.auth.getSession();
  const uid = sess.session?.user?.id;
  const { data } = await sb
    .from("grubs")
    .select("subject_id,user_id")
    .eq("subject_type", subjectType)
    .in("subject_id", ids);
  for (const g of (data as { subject_id: string; user_id: string }[]) ?? []) {
    const e = out[g.subject_id];
    if (!e) continue;
    e.count++;
    if (uid && g.user_id === uid) e.grubbed = true;
  }
  return out;
}

export async function setGrub(
  subjectType: Subject,
  subjectId: string,
  active: boolean,
): Promise<void> {
  const c = await ctx();
  if (!c) return;
  if (active) {
    await c.sb
      .from("grubs")
      .upsert(
        { user_id: c.uid, subject_type: subjectType, subject_id: subjectId },
        { onConflict: "user_id,subject_type,subject_id", ignoreDuplicates: true },
      );
  } else {
    await c.sb
      .from("grubs")
      .delete()
      .eq("user_id", c.uid)
      .eq("subject_type", subjectType)
      .eq("subject_id", subjectId);
  }
}

// ----- Duplicate a public map into your own -----

export async function duplicateMap(publicMapId: string): Promise<string | null> {
  const c = await ctx();
  if (!c) return null;
  const { data: m } = await c.sb.from("maps").select("*").eq("id", publicMapId).maybeSingle();
  if (!m) return null;
  const { data: items } = await c.sb
    .from("map_items")
    .select("*")
    .eq("map_id", publicMapId)
    .order("position", { ascending: true });
  const newId = crypto.randomUUID();
  await c.sb.from("maps").insert({
    id: newId,
    user_id: c.uid,
    name: (m as { name: string }).name,
    mode: (m as { mode: string }).mode,
    visibility: "private",
  });
  const rows = (items as { name: string; label: string | null; lat: number; lon: number }[]) ?? [];
  if (rows.length) {
    await c.sb.from("map_items").insert(
      rows.map((it, i) => ({
        id: crypto.randomUUID(),
        map_id: newId,
        name: it.name,
        label: it.label,
        lat: it.lat,
        lon: it.lon,
        position: i,
        visited: false,
      })),
    );
  }
  return newId;
}

// ----- Safety: block / report -----

export async function blockUser(userId: string): Promise<void> {
  const c = await ctx();
  if (!c || c.uid === userId) return;
  await c.sb.from("blocks").upsert({ blocker_id: c.uid, blocked_id: userId });
}

export async function unblockUser(userId: string): Promise<void> {
  const c = await ctx();
  if (!c) return;
  await c.sb.from("blocks").delete().eq("blocker_id", c.uid).eq("blocked_id", userId);
}

export async function listBlocked(): Promise<string[]> {
  const c = await ctx();
  if (!c) return [];
  const { data } = await c.sb.from("blocks").select("blocked_id").eq("blocker_id", c.uid);
  return (data as { blocked_id: string }[] | null)?.map((b) => b.blocked_id) ?? [];
}

export async function reportContent(
  targetType: "yonder" | "map" | "profile",
  targetId: string,
  reason: string,
): Promise<void> {
  const c = await ctx();
  if (!c) return;
  await c.sb.from("reports").insert({
    reporter_id: c.uid,
    target_type: targetType,
    target_id: targetId,
    reason,
  });
}
