"use client";
import { useEffect, useState } from "react";
import { usePaywall } from "@/components/PaywallProvider";
import { bumpUsage, getUsage } from "@/lib/data";
import { FEATURE_REASON, type FeatureKey, type MeterKey } from "@/lib/plans";
import { useEntitlement } from "./useEntitlement";

// Gate a Yonder+ feature. `allowed` for conditional UI; `guard()` returns true
// when allowed, else opens the paywall and returns false (use it inline before
// running the action).
export function useGate(feature: FeatureKey) {
  const { premium } = useEntitlement();
  const { requirePlus, config } = usePaywall();
  const allowed = premium || !config.plusFeatures[feature];
  const guard = () => {
    if (allowed) return true;
    requirePlus(FEATURE_REASON[feature]);
    return false;
  };
  return { allowed, premium, guard };
}

// A metered free allowance (Yonder+ = unlimited). `consume()` records a use and
// returns true if allowed, else opens the paywall and returns false.
export function useMeter(key: MeterKey, reason: string) {
  const { premium } = useEntitlement();
  const { requirePlus, config } = usePaywall();
  const [used, setUsed] = useState(0);
  useEffect(() => {
    void getUsage(key).then(setUsed);
  }, [key]);
  const limit = config.meters[key].free;
  const remaining = premium ? Infinity : Math.max(0, limit - used);
  const consume = async () => {
    if (premium) return true;
    if (used >= limit) {
      requirePlus(reason);
      return false;
    }
    const n = await bumpUsage(key);
    setUsed(n);
    return true;
  };
  return { remaining, premium, consume };
}
