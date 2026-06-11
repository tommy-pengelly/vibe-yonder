"use client";
import { areaLabel, obfuscateTrace, type PrivacyZone } from "../privacy";
import type { SavedYonder, Visibility } from "../types";
import { ctx } from "./ctx";
import { createYonderPost, deleteYonderPost } from "./posts";

export type ShareVisibility = Exclude<Visibility, "private">;

/**
 * Publish an OBFUSCATED copy of a finished yonder. The precise track never
 * leaves the private `yonders` table, we write only public-safe fields, the
 * obfuscated memento (home zone removed, ends trimmed, coords stripped), and
 * the shared destinations. Re-publishing replaces the prior copy.
 */
export async function publishYonder(
  y: SavedYonder,
  opts: { visibility: ShareVisibility; caption?: string; zone?: PrivacyZone },
): Promise<void> {
  const c = await ctx();
  if (!c) return;
  await c.sb.from("shared_yonders").delete().eq("yonder_id", y.id);
  await c.sb.from("shared_yonders").insert({
    id: crypto.randomUUID(),
    yonder_id: y.id,
    user_id: c.uid,
    visibility: opts.visibility,
    caption: opts.caption?.trim() || null,
    area: areaLabel(y.destinations),
    walked_m: y.walked,
    duration_s: Math.round(y.durationMs / 1000),
    places: y.destinations.length,
    yondered: y.yondered,
    trace_public: obfuscateTrace(y.track, opts.zone),
    destinations: y.destinations,
  });
  // Dual-write the unified post (0013). Safe no-op until the table exists.
  await createYonderPost(y, opts);
}

export async function unpublishYonder(yonderId: string): Promise<void> {
  const c = await ctx();
  if (!c) return;
  await c.sb.from("shared_yonders").delete().eq("yonder_id", yonderId);
  await deleteYonderPost(yonderId);
}

/** Current share status of one of your own yonders (for the recap control). */
export async function shareStatus(
  yonderId: string,
): Promise<{ visibility: ShareVisibility } | null> {
  const c = await ctx();
  if (!c) return null;
  const { data } = await c.sb
    .from("shared_yonders")
    .select("visibility")
    .eq("yonder_id", yonderId)
    .maybeSingle();
  return data ? { visibility: (data as { visibility: ShareVisibility }).visibility } : null;
}
