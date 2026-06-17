"use client";
import { getSupabase } from "../supabase/client";
import type {
  Destination,
  FeedItem,
  FeedMap,
  FeedYonder,
  Medal,
  MedalBands,
} from "../types";
import { ctx } from "./ctx";
import { grubCountsFor } from "./social";

type SharedRow = {
  id: string;
  user_id: string;
  caption: string | null;
  area: string | null;
  walked_m: number | null;
  duration_s: number | null;
  places: number | null;
  yondered: number | null;
  trace_public: number[][] | null;
  destinations: Destination[] | null;
  created_at: string | null;
};

type MiniProfile = { username: string; displayName?: string; avatarUrl?: string };

export function relTime(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const s = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

async function profilesByIds(ids: string[]): Promise<Record<string, MiniProfile>> {
  const out: Record<string, MiniProfile> = {};
  const sb = getSupabase();
  if (!sb || ids.length === 0) return out;
  const { data } = await sb
    .from("profiles")
    .select("id,username,display_name,avatar_url")
    .in("id", [...new Set(ids)]);
  for (const p of (data as {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  }[]) ?? []) {
    out[p.id] = {
      username: p.username ?? "wanderer",
      displayName: p.display_name ?? undefined,
      avatarUrl: p.avatar_url ?? undefined,
    };
  }
  return out;
}

async function shapeShared(rows: SharedRow[]): Promise<FeedYonder[]> {
  if (rows.length === 0) return [];
  const profiles = await profilesByIds(rows.map((r) => r.user_id));
  const grubs = await grubCountsFor("yonder", rows.map((r) => r.id));
  return rows.map((r) => {
    const p = profiles[r.user_id] ?? { username: "wanderer" };
    const g = grubs[r.id] ?? { count: 0, grubbed: false };
    return {
      id: r.id,
      userId: r.user_id,
      who: p.displayName ?? `@${p.username}`,
      handle: `@${p.username}`,
      avatarUrl: p.avatarUrl,
      when: relTime(r.created_at),
      caption: r.caption,
      area: r.area ?? "somewhere",
      walked: r.walked_m ?? 0,
      mins: Math.round((r.duration_s ?? 0) / 60),
      places: r.places ?? r.destinations?.length ?? 0,
      yondered: r.yondered ?? 1,
      trace: r.trace_public ?? [],
      destinations: r.destinations ?? [],
      grubs: g.count,
      grubbed: g.grubbed,
    };
  });
}

const SHARED_COLS =
  "id,user_id,caption,area,walked_m,duration_s,places,yondered,trace_public,destinations,created_at";

export type SharedPage = { items: FeedYonder[]; nextCursor: string | null };

/** A user's public shared yonders (for their profile). Reads `posts`, the one
 * sharing path, so the profile and the feed always agree (no more "in the feed
 * but not on my profile"). Keyset-cursor paginated like the feed. */
export async function loadUserShared(
  userId: string,
  cursor: string | null = null,
): Promise<SharedPage> {
  const sb = getSupabase();
  if (!sb) return { items: [], nextCursor: null };
  let qy = sb
    .from("posts")
    .select(FEED_COLS)
    .eq("user_id", userId)
    .eq("kind", "yonder")
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(FEED_PAGE);
  if (cursor) qy = qy.lt("created_at", cursor);
  const { data } = await qy;
  const rows = (data as FeedPostRow[]) ?? [];
  const nextCursor =
    rows.length === FEED_PAGE ? (rows.at(-1)?.created_at ?? null) : null;
  return { items: await shapeFeedYonders(rows), nextCursor };
}

export async function getSharedYonder(id: string): Promise<FeedYonder | null> {
  const sb = getSupabase();
  if (!sb) return null;
  // Feed cards use post ids; resolve a post first, fall back to a legacy
  // shared_yonders id (e.g. from search results).
  const { data: post } = await sb
    .from("posts")
    .select(FEED_COLS)
    .eq("id", id)
    .eq("kind", "yonder")
    .maybeSingle();
  if (post) return (await shapeFeedYonders([post as FeedPostRow]))[0] ?? null;
  const { data } = await sb.from("shared_yonders").select(SHARED_COLS).eq("id", id).maybeSingle();
  if (!data) return null;
  return (await shapeShared([data as SharedRow]))[0] ?? null;
}

// ----- Unified feed: every community item is a post -----

type FeedPostRow = {
  id: string;
  user_id: string;
  kind: "yonder" | "map" | "ways" | "mission";
  ref_id: string | null;
  caption: string | null;
  area: string | null;
  payload: Record<string, unknown>;
  created_at: string | null;
};

const FEED_COLS = "id,user_id,kind,ref_id,caption,area,payload,created_at";

/** Shape yonder-kind post rows into FeedYonder (id = post.id). */
async function shapeFeedYonders(rows: FeedPostRow[]): Promise<FeedYonder[]> {
  if (rows.length === 0) return [];
  const profiles = await profilesByIds(rows.map((r) => r.user_id));
  const grubs = await grubCountsFor("post", rows.map((r) => r.id));
  return rows.map((r) => {
    const p = profiles[r.user_id] ?? { username: "wanderer" };
    const g = grubs[r.id] ?? { count: 0, grubbed: false };
    const pl = r.payload ?? {};
    const dests = (pl.destinations as Destination[]) ?? [];
    return {
      id: r.id,
      userId: r.user_id,
      who: p.displayName ?? `@${p.username}`,
      handle: `@${p.username}`,
      avatarUrl: p.avatarUrl,
      when: relTime(r.created_at),
      caption: r.caption,
      area: r.area ?? "somewhere",
      walked: (pl.walked_m as number) ?? 0,
      mins: Math.round(((pl.duration_s as number) ?? 0) / 60),
      places: (pl.places as number) ?? dests.length,
      yondered: (pl.yondered as number) ?? 1,
      trace: (pl.trace_public as number[][]) ?? [],
      destinations: dests,
      grubs: g.count,
      grubbed: g.grubbed,
      medal: (pl.medal as Medal) ?? undefined,
      missionId: (pl.missionId as string) ?? undefined,
    };
  });
}

export const FEED_PAGE = 20;

export type FeedPage = { items: FeedItem[]; nextCursor: string | null };
const EMPTY_FEED: FeedPage = { items: [], nextCursor: null };

/** A page of the feed: posts of any kind → typed feed items. Community =
 * everything public; following = posts by people you follow.
 *
 * Keyset (cursor) pagination, NOT offset: pass the previous page's `nextCursor`
 * (the last item's created_at) to get the next page via `created_at < cursor`.
 * Drift-proof, a post arriving mid-scroll can't shift rows across pages the way
 * an offset would. `nextCursor` is null when there's no more. (created_at is
 * microsecond-precise, so same-timestamp ties are effectively impossible here.) */
export async function loadFeed(
  scope: "community" | "following",
  cursor: string | null = null,
): Promise<FeedPage> {
  const sb = getSupabase();
  if (!sb) return EMPTY_FEED;

  let rows: FeedPostRow[] = [];
  let meId: string | null = null; // for the "You" label on your own posts
  if (scope === "following") {
    const c = await ctx();
    if (!c) return EMPTY_FEED;
    meId = c.uid;
    const { data: follows } = await c.sb
      .from("follows")
      .select("following_id")
      .eq("follower_id", c.uid)
      .eq("status", "accepted");
    const followed =
      (follows as { following_id: string }[] | null)?.map((f) => f.following_id) ?? [];
    // Include yourself: your own shared yonders show in Following too (labelled
    // "You"), so the feed is never empty and you see your wanders in context.
    const ids = Array.from(new Set([...followed, c.uid]));
    let qy = c.sb
      .from("posts")
      .select(FEED_COLS)
      .in("user_id", ids)
      .order("created_at", { ascending: false })
      .limit(FEED_PAGE);
    if (cursor) qy = qy.lt("created_at", cursor);
    const { data, error } = await qy;
    if (error) return EMPTY_FEED;
    rows = (data as FeedPostRow[]) ?? [];
  } else {
    let qy = sb
      .from("posts")
      .select(FEED_COLS)
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(FEED_PAGE);
    if (cursor) qy = qy.lt("created_at", cursor);
    const { data, error } = await qy;
    if (error) return EMPTY_FEED;
    rows = (data as FeedPostRow[]) ?? [];
  }
  if (rows.length === 0) return EMPTY_FEED;
  const nextCursor =
    rows.length === FEED_PAGE ? (rows.at(-1)?.created_at ?? null) : null;

  const profiles = await profilesByIds(rows.map((r) => r.user_id));
  const grubs = await grubCountsFor(
    "post",
    rows.filter((r) => r.kind !== "ways").map((r) => r.id),
  );

  const items = rows.map((r): FeedItem => {
    const p = profiles[r.user_id] ?? { username: "wanderer" };
    const who = r.user_id === meId ? "You" : (p.displayName ?? `@${p.username}`);
    const handle = `@${p.username}`;
    const when = relTime(r.created_at);
    const g = grubs[r.id] ?? { count: 0, grubbed: false };
    const pl = r.payload ?? {};

    if (r.kind === "map") {
      const dests = (pl.destinations as Destination[]) ?? [];
      return {
        kind: "map",
        id: r.id,
        when,
        m: {
          id: r.id,
          mapId: r.ref_id ?? undefined,
          name: (pl.name as string) ?? "A map",
          who: handle,
          places: dests.length,
          grubs: g.count,
          grubbed: g.grubbed,
          destinations: dests,
          previewDots: scatter(dests),
        },
      };
    }
    if (r.kind === "ways") {
      return {
        kind: "ways",
        id: r.id,
        when,
        w: {
          id: r.id,
          who,
          handle,
          avatarUrl: p.avatarUrl,
          when,
          caption: r.caption,
          count: (pl.count as number) ?? 0,
          km: (pl.km as number) ?? 0,
          placesSeen: (pl.placesSeen as number) ?? 0,
          traces: (pl.traces as number[][][]) ?? [],
        },
      };
    }
    if (r.kind === "mission") {
      return {
        kind: "mission",
        id: r.id,
        when,
        mi: {
          id: r.id,
          missionId: r.ref_id ?? r.id,
          who,
          handle,
          avatarUrl: p.avatarUrl,
          when,
          name: (pl.name as string) ?? "Straight-line mission",
          distanceM: (pl.distance_m as number) ?? 0,
          a:
            pl.a_lat != null
              ? { lat: pl.a_lat as number, lon: pl.a_lon as number }
              : undefined,
          b:
            pl.b_lat != null
              ? { lat: pl.b_lat as number, lon: pl.b_lon as number }
              : undefined,
          bands: (pl.bands as MedalBands | undefined) ?? undefined,
        },
      };
    }
    // yonder
    const dests = (pl.destinations as Destination[]) ?? [];
    return {
      kind: "yonder",
      id: r.id,
      when,
      y: {
        id: r.id,
        userId: r.user_id,
        who,
        handle,
        avatarUrl: p.avatarUrl,
        when,
        caption: r.caption,
        area: r.area ?? "somewhere",
        walked: (pl.walked_m as number) ?? 0,
        mins: Math.round(((pl.duration_s as number) ?? 0) / 60),
        places: (pl.places as number) ?? dests.length,
        yondered: (pl.yondered as number) ?? 1,
        trace: (pl.trace_public as number[][]) ?? [],
        destinations: dests,
        grubs: g.count,
        grubbed: g.grubbed,
        medal: (pl.medal as Medal) ?? undefined,
        missionId: (pl.missionId as string) ?? undefined,
      },
    };
  });

  // Podium peek: batch-load the top of the board for the missions on this page.
  const missionIds = items
    .filter((i): i is Extract<FeedItem, { kind: "mission" }> => i.kind === "mission")
    .map((i) => i.mi.missionId);
  if (missionIds.length > 0) {
    const { data: atts } = await sb
      .from("mission_attempts")
      .select("mission_id,user_id,medal,max_deviation")
      .in("mission_id", missionIds)
      .order("max_deviation", { ascending: true });
    const top = new Map<string, { userId: string; medal: Medal }[]>();
    for (const a of (atts as { mission_id: string; user_id: string; medal: Medal | null }[]) ??
      []) {
      const arr = top.get(a.mission_id) ?? [];
      if (arr.length < 3) arr.push({ userId: a.user_id, medal: a.medal ?? "none" });
      top.set(a.mission_id, arr);
    }
    const topProfiles = await profilesByIds(
      [...top.values()].flat().map((t) => t.userId),
    );
    for (const item of items) {
      if (item.kind !== "mission") continue;
      item.mi.top = (top.get(item.mi.missionId) ?? []).map((t) => ({
        handle: `@${topProfiles[t.userId]?.username ?? "wanderer"}`,
        medal: t.medal,
      }));
    }
  }

  return { items, nextCursor };
}

// ----- Ways reports (posts kind='ways') -----

// ----- Community: public yonders + public maps -----

type PublicMapRow = { id: string; user_id: string; name: string };
type PublicItemRow = { map_id: string; name: string; label: string | null; lat: number; lon: number };

function scatter(dests: Destination[]): number[][] {
  if (dests.length === 0) return [];
  const lats = dests.map((d) => d.lat);
  const lons = dests.map((d) => d.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const span = Math.max((maxLon - minLon) * kx, maxLat - minLat, 1e-7);
  const PAD = 18;
  const SCALE = 100 - 2 * PAD;
  return dests.map((d) => [
    +(PAD + (((d.lon - minLon) * kx) / span) * SCALE).toFixed(1),
    +(100 - PAD - ((d.lat - minLat) / span) * SCALE).toFixed(1),
  ]);
}

export async function loadCommunity(
  q = "",
  sort: "recent" | "popular" = "recent",
): Promise<{ yonders: FeedYonder[]; maps: FeedMap[] }> {
  const sb = getSupabase();
  if (!sb) return { yonders: [], maps: [] };

  const { data: postRows } = await sb
    .from("posts")
    .select(FEED_COLS)
    .eq("kind", "yonder")
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(50);
  const yonders = await shapeFeedYonders((postRows as FeedPostRow[]) ?? []);

  const { data: mapRows } = await sb
    .from("maps")
    .select("id,user_id,name")
    .eq("visibility", "public")
    .order("updated_at", { ascending: false })
    .limit(50);
  const mr = (mapRows as PublicMapRow[]) ?? [];
  let maps: FeedMap[] = [];
  if (mr.length) {
    const { data: items } = await sb
      .from("map_items")
      .select("map_id,name,label,lat,lon")
      .in("map_id", mr.map((m) => m.id))
      .order("position", { ascending: true });
    const byMap = new Map<string, Destination[]>();
    for (const it of (items as PublicItemRow[]) ?? []) {
      const arr = byMap.get(it.map_id) ?? [];
      arr.push({ name: it.name, label: it.label ?? undefined, lat: it.lat, lon: it.lon });
      byMap.set(it.map_id, arr);
    }
    const profiles = await profilesByIds(mr.map((m) => m.user_id));
    const grubs = await grubCountsFor("map", mr.map((m) => m.id));
    maps = mr.map((m) => {
      const dests = byMap.get(m.id) ?? [];
      const g = grubs[m.id] ?? { count: 0, grubbed: false };
      return {
        id: m.id,
        name: m.name,
        who: `@${profiles[m.user_id]?.username ?? "wanderer"}`,
        places: dests.length,
        grubs: g.count,
        grubbed: g.grubbed,
        destinations: dests,
        previewDots: scatter(dests),
      };
    });
  }

  const term = q.trim().toLowerCase();
  let ys = term
    ? yonders.filter((y) => (y.who + y.handle + y.area + (y.caption ?? "")).toLowerCase().includes(term))
    : yonders;
  let ms = term ? maps.filter((m) => (m.name + m.who).toLowerCase().includes(term)) : maps;
  if (sort === "popular") {
    ys = [...ys].sort((a, b) => b.grubs - a.grubs);
    ms = [...ms].sort((a, b) => b.grubs - a.grubs);
  }
  return { yonders: ys, maps: ms };
}
