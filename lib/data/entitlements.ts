"use client";
import { ctx } from "./ctx";

export type Entitlement = {
  premium: boolean;
  tier: "free" | "plus";
  status: string;
  until?: number; // current_period_end ms
};

const FREE: Entitlement = { premium: false, tier: "free", status: "inactive" };

// A dev/testing override so the gated UX can be exercised before Stripe is
// wired: set NEXT_PUBLIC_PREMIUM_ALL=true to treat everyone as Yonder+.
const FORCE_PREMIUM = process.env.NEXT_PUBLIC_PREMIUM_ALL === "true";

/** The current user's Yonder+ entitlement. Guests + no-row = free. */
export async function loadEntitlement(): Promise<Entitlement> {
  if (FORCE_PREMIUM) return { premium: true, tier: "plus", status: "active" };
  const c = await ctx();
  if (!c) return FREE;
  const { data, error } = await c.sb
    .from("entitlements")
    .select("tier,status,current_period_end")
    .eq("user_id", c.uid)
    .maybeSingle();
  if (error || !data) return FREE;
  const row = data as {
    tier: "free" | "plus";
    status: string;
    current_period_end: string | null;
  };
  const until = row.current_period_end
    ? new Date(row.current_period_end).getTime()
    : undefined;
  const active =
    row.tier === "plus" &&
    (row.status === "active" || row.status === "trialing") &&
    (until == null || until > Date.now());
  return { premium: active, tier: row.tier, status: row.status, until };
}
