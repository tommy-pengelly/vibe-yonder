"use client";
import type { PrivacyZone } from "../privacy";
import type { SavedYonder, Visibility } from "../types";
import { ctx } from "./ctx";
import { createYonderPost, deleteYonderPost } from "./posts";

export type ShareVisibility = Exclude<Visibility, "private">;

/**
 * Publish an OBFUSCATED copy of a finished yonder as a `posts` row, the ONE
 * sharing path (SCHEMA.md). The precise track never leaves the private
 * `yonders` table; the post carries only the public-safe memento (home zone
 * removed, ends trimmed, coords stripped) + the shared destinations. The legacy
 * `shared_yonders` table is retired, this is what the feed AND the profile read.
 */
export async function publishYonder(
  y: SavedYonder,
  opts: { visibility: ShareVisibility; caption?: string; zone?: PrivacyZone },
): Promise<void> {
  await createYonderPost(y, opts);
}

export async function unpublishYonder(yonderId: string): Promise<void> {
  await deleteYonderPost(yonderId);
}

/** Current share status of one of your own yonders (for the recap control). */
export async function shareStatus(
  yonderId: string,
): Promise<{ visibility: ShareVisibility } | null> {
  const c = await ctx();
  if (!c) return null;
  const { data } = await c.sb
    .from("posts")
    .select("visibility")
    .eq("user_id", c.uid)
    .eq("kind", "yonder")
    .eq("ref_id", yonderId)
    .maybeSingle();
  return data ? { visibility: (data as { visibility: ShareVisibility }).visibility } : null;
}
