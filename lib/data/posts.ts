"use client";
import { areaLabel, obfuscateTrace, type PrivacyZone } from "../privacy";
import type { Destination, SavedYonder, Visibility } from "../types";
import { ctx } from "./ctx";

// Unified posts (migration 0013). All writes are guarded: if the table isn't
// there yet they warn and no-op, so the app is unaffected until 0013 is applied
// (the legacy shared_yonders / map-visibility paths still run alongside).

export type PostKind = "yonder" | "map" | "ways" | "mission";
export type PostVisibility = Visibility; // private | followers | public

export type WaysPayload = {
  count: number;
  km: number;
  placesSeen: number;
  /** Overlaid normalised traces (0–100), already obfuscation-safe. */
  traces: number[][][];
  title?: string;
};

const TABLE_MISSING = "posts table not found, apply migration 0013";

/** Publish (or re-publish) a post for a finished yonder. Carries only the
 * public-safe memento, never the precise track. */
export async function createYonderPost(
  y: SavedYonder,
  // visibility "private" = unlisted: a post still exists (so a shared link
  // opens), it just never appears in any feed.
  opts: { visibility: Visibility; caption?: string; zone?: PrivacyZone },
): Promise<void> {
  const c = await ctx();
  if (!c) return;
  await c.sb
    .from("posts")
    .delete()
    .eq("user_id", c.uid)
    .eq("kind", "yonder")
    .eq("ref_id", y.id);
  const { error } = await c.sb.from("posts").insert({
    user_id: c.uid,
    kind: "yonder",
    ref_id: y.id,
    caption: opts.caption?.trim() || null,
    visibility: opts.visibility,
    area: areaLabel(y.destinations),
    payload: {
      walked_m: y.walked,
      duration_s: Math.round(y.durationMs / 1000),
      places: y.destinations.length,
      yondered: y.yondered,
      trace_public: obfuscateTrace(y.track, opts.zone),
      destinations: y.destinations,
      // Straight-line: the medal is the card's highlight, with a link to the
      // mission's board where the live ranking lives.
      medal: y.straightLine?.medal,
      missionId: y.missionId,
    },
  });
  if (error) console.warn(`createYonderPost: ${TABLE_MISSING} (${error.message})`);
}

export async function deleteYonderPost(yonderId: string): Promise<void> {
  const c = await ctx();
  if (!c) return;
  const { error } = await c.sb
    .from("posts")
    .delete()
    .eq("user_id", c.uid)
    .eq("kind", "yonder")
    .eq("ref_id", yonderId);
  if (error) console.warn(`deleteYonderPost: ${error.message}`);
}

/** Mirror a map's community state as a post: upsert when public, remove when not. */
export async function setMapPost(
  map: { id: string; name: string; items: { name: string; lat: number; lon: number }[] },
  isPublic: boolean,
): Promise<void> {
  const c = await ctx();
  if (!c) return;
  await c.sb
    .from("posts")
    .delete()
    .eq("user_id", c.uid)
    .eq("kind", "map")
    .eq("ref_id", map.id);
  if (!isPublic) return;
  const { error } = await c.sb.from("posts").insert({
    user_id: c.uid,
    kind: "map",
    ref_id: map.id,
    visibility: "public",
    payload: {
      name: map.name,
      destinations: map.items.map((i) => ({ name: i.name, lat: i.lat, lon: i.lon })),
    },
  });
  if (error) console.warn(`setMapPost: ${TABLE_MISSING} (${error.message})`);
}

/** Post a "ways report", your exploration overview. */
export async function createWaysPost(opts: {
  caption?: string;
  visibility: Exclude<Visibility, "private">;
  payload: WaysPayload;
}): Promise<boolean> {
  const c = await ctx();
  if (!c) return false;
  const { error } = await c.sb.from("posts").insert({
    user_id: c.uid,
    kind: "ways",
    ref_id: null,
    caption: opts.caption?.trim() || null,
    visibility: opts.visibility,
    payload: opts.payload as unknown as Record<string, unknown>,
  });
  if (error) {
    console.warn(`createWaysPost: ${TABLE_MISSING} (${error.message})`);
    return false;
  }
  return true;
}

export type PostRow = {
  id: string;
  user_id: string;
  kind: PostKind;
  ref_id: string | null;
  caption: string | null;
  visibility: PostVisibility;
  area: string | null;
  payload: Record<string, unknown>;
  created_at: string | null;
};

export type FeedPost = {
  id: string;
  kind: PostKind;
  caption: string | null;
  area: string | null;
  when: string;
  payload: Record<string, unknown>;
  // joined author
  who: string;
  handle: string;
  avatarUrl?: string;
  destinations: Destination[];
};
