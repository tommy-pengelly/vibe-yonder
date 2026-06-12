"use client";
import type { ReportItem } from "../types";
import { ctx } from "./ctx";
import { relTime } from "./feed";
import { getProfileByUsername, getProfilesByIds } from "./profiles";

export async function amAdmin(): Promise<boolean> {
  const c = await ctx();
  if (!c) return false;
  const { data } = await c.sb.from("profiles").select("is_admin").eq("id", c.uid).maybeSingle();
  return Boolean((data as { is_admin?: boolean } | null)?.is_admin);
}

/** Admin: grant or revoke Yonder+ for a user (a comp account). */
export async function setPlusByUsername(username: string, on: boolean): Promise<boolean> {
  const c = await ctx();
  if (!c) return false;
  const prof = await getProfileByUsername(username.replace(/^@/, "").trim());
  if (!prof) return false;
  const { error } = await c.sb.from("entitlements").upsert(
    {
      user_id: prof.id,
      tier: on ? "plus" : "free",
      status: on ? "active" : "canceled",
      current_period_end: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  return !error;
}

/** Admin: current Yonder+ holders (comp + paying). */
export async function loadPlusMembers(): Promise<{ handle: string; status: string }[]> {
  const c = await ctx();
  if (!c) return [];
  const { data } = await c.sb
    .from("entitlements")
    .select("user_id,status")
    .eq("tier", "plus")
    .order("updated_at", { ascending: false });
  const rows = (data as { user_id: string; status: string }[]) ?? [];
  if (rows.length === 0) return [];
  const profiles = await getProfilesByIds(rows.map((r) => r.user_id));
  const byId = new Map(profiles.map((p) => [p.id, p]));
  return rows.map((r) => ({
    handle: `@${byId.get(r.user_id)?.username ?? "wanderer"}`,
    status: r.status,
  }));
}

type ReportRow = {
  id: string;
  reporter_id: string | null;
  target_type: string;
  target_id: string;
  reason: string | null;
  resolved: boolean;
  created_at: string | null;
};

/** The report queue, returns [] for non-admins (RLS gates it). */
export async function loadReports(): Promise<ReportItem[]> {
  const c = await ctx();
  if (!c) return [];
  const { data } = await c.sb
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = (data as ReportRow[]) ?? [];
  const profiles = await getProfilesByIds(rows.map((r) => r.reporter_id).filter((x): x is string => !!x));
  const byId = new Map(profiles.map((p) => [p.id, p]));
  return rows.map((r) => {
    const p = r.reporter_id ? byId.get(r.reporter_id) : undefined;
    return {
      id: r.id,
      reporter: p ? { username: p.username, displayName: p.displayName } : null,
      targetType: r.target_type,
      targetId: r.target_id,
      reason: r.reason,
      resolved: r.resolved,
      when: relTime(r.created_at),
    };
  });
}

export async function resolveReport(id: string): Promise<void> {
  const c = await ctx();
  if (!c) return;
  await c.sb.from("reports").update({ resolved: true }).eq("id", id);
}
