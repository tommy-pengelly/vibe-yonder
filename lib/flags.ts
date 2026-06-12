// Build-time feature flags. Flip via public env vars at deploy.
//
// Keep this tiny and honest: a flag here means "this is hidden/off for everyone
// right now," not a per-user entitlement (that's the Yonder+ gating in
// lib/plans.ts). Use a flag to park a feature that isn't pulling its weight yet.

// The on-walk DISCOVERY layer: the faint constellation of nearby places on the
// scope, the "around you" suggestions sheet, and the /api/nearby (Overpass)
// fetches behind them. Off by default while the discovery taste is reworked, so
// a wander stays a clean void: you, the marker, the place. Set
// NEXT_PUBLIC_DISCOVERY=on to bring it back.
export const DISCOVERY_ENABLED = process.env.NEXT_PUBLIC_DISCOVERY === "on";
