"use client";
import { METERS, PLUS_FEATURES, type FeatureKey, type MeterKey } from "../plans";
import { getSupabase } from "../supabase/client";
import { ctx } from "./ctx";

export type PlanConfig = {
  plusFeatures: Record<FeatureKey, boolean>;
  meters: Record<MeterKey, { free: number; period: "month" }>;
};

/** Code defaults; the DB overrides per-row. */
export const DEFAULT_PLAN: PlanConfig = {
  plusFeatures: { ...PLUS_FEATURES },
  meters: { ...METERS },
};

/** The live plan: code defaults merged with admin-set DB overrides. */
export async function loadPlanConfig(): Promise<PlanConfig> {
  const sb = getSupabase();
  const plusFeatures = { ...PLUS_FEATURES };
  const meters = { ...METERS };
  if (sb) {
    const [{ data: gates }, { data: limits }] = await Promise.all([
      sb.from("feature_gates").select("feature,requires_plus"),
      sb.from("meter_limits").select("meter,free_limit,period"),
    ]);
    for (const g of (gates as { feature: string; requires_plus: boolean }[]) ?? []) {
      if (g.feature in plusFeatures) plusFeatures[g.feature as FeatureKey] = g.requires_plus;
    }
    for (const l of (limits as { meter: string; free_limit: number }[]) ?? []) {
      if (l.meter in meters) meters[l.meter as MeterKey].free = l.free_limit;
    }
  }
  return { plusFeatures, meters };
}

/** Admin: gate or ungate a feature, live. */
export async function setFeatureGate(feature: FeatureKey, plus: boolean): Promise<void> {
  const c = await ctx();
  if (!c) return;
  await c.sb
    .from("feature_gates")
    .upsert(
      { feature, requires_plus: plus, updated_at: new Date().toISOString() },
      { onConflict: "feature" },
    );
}

/** Admin: set a meter's free allowance, live. */
export async function setMeterLimit(meter: MeterKey, free: number): Promise<void> {
  const c = await ctx();
  if (!c) return;
  await c.sb
    .from("meter_limits")
    .upsert(
      { meter, free_limit: free, period: "month", updated_at: new Date().toISOString() },
      { onConflict: "meter" },
    );
}
