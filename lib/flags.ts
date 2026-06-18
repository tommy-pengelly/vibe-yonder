// Build-time feature flags. Flip via public env vars at deploy.
//
// Keep this tiny and honest: a flag here means "this is hidden/off for everyone
// right now," not a per-user entitlement (that's the Yonder+ gating in
// lib/plans.ts). Use a flag to park a feature that isn't pulling its weight yet.

// The on-walk DISCOVERY layer: the constellation of nearby places on the scope,
// the "around you" suggestions sheet, and the /api/nearby (Overpass + Wikidata)
// fetches behind them. ON by default now the federated engine is good; set
// NEXT_PUBLIC_DISCOVERY=off to park it again.
export const DISCOVERY_ENABLED = process.env.NEXT_PUBLIC_DISCOVERY !== "off";
