"use client";
import { ctx } from "./ctx";

// Metered free-tier usage. The period bucket is the current calendar month
// (e.g. "2026-06"), so allowances reset monthly without a cron.

export function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** How many times the current user has used `key` this period. */
export async function getUsage(key: string): Promise<number> {
  const c = await ctx();
  if (!c) return 0;
  const { data } = await c.sb
    .from("usage_counters")
    .select("count")
    .eq("user_id", c.uid)
    .eq("key", key)
    .eq("period", currentPeriod())
    .maybeSingle();
  return (data as { count: number } | null)?.count ?? 0;
}

/** Increment `key` for this period; returns the new count. */
export async function bumpUsage(key: string): Promise<number> {
  const c = await ctx();
  if (!c) return 0;
  const period = currentPeriod();
  const next = (await getUsage(key)) + 1;
  await c.sb.from("usage_counters").upsert(
    { user_id: c.uid, key, period, count: next, updated_at: new Date().toISOString() },
    { onConflict: "user_id,key,period" },
  );
  return next;
}
