"use client";
import type { NotificationItem } from "../types";
import { ctx } from "./ctx";
import { relTime } from "./feed";
import { getProfilesByIds } from "./profiles";

type Row = {
  id: string;
  type: NotificationItem["type"];
  actor_id: string | null;
  subject_type: "yonder" | "map" | null;
  subject_id: string | null;
  read: boolean;
  created_at: string | null;
};

export async function loadNotifications(): Promise<NotificationItem[]> {
  const c = await ctx();
  if (!c) return [];
  const { data } = await c.sb
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  const rows = (data as Row[]) ?? [];
  const profiles = await getProfilesByIds(rows.map((r) => r.actor_id).filter((x): x is string => !!x));
  const byId = new Map(profiles.map((p) => [p.id, p]));
  return rows.map((r) => {
    const p = r.actor_id ? byId.get(r.actor_id) : undefined;
    return {
      id: r.id,
      type: r.type,
      actor: p ? { username: p.username, displayName: p.displayName } : null,
      subjectType: r.subject_type ?? undefined,
      subjectId: r.subject_id ?? undefined,
      when: relTime(r.created_at),
      read: r.read,
    };
  });
}

export async function unreadNotificationCount(): Promise<number> {
  const c = await ctx();
  if (!c) return 0;
  const { count } = await c.sb
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("read", false);
  return count ?? 0;
}

export async function markNotificationsRead(): Promise<void> {
  const c = await ctx();
  if (!c) return;
  await c.sb.from("notifications").update({ read: true }).eq("user_id", c.uid).eq("read", false);
}
