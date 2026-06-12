// The free / Yonder+ split lives here, as data — change a line to move a
// feature across the line or retune a meter, no other code moves. (Later this
// can be backed by a DB table so it's editable without a deploy.)
//
// The core wander is never listed: picking a place and walking to it, the
// recap, follow + share, and the on-walk discovery are free forever.

export type FeatureKey =
  | "freeRoam" // ambient "just wander", no destination
  | "maps" // make + walk multi-place maps
  | "missionsBrowse" // the missions board / browsing
  | "createMission" // publish your own mission
  | "customMedals" // set a mission's medal thresholds
  | "heatmap" // lifetime overlay of everywhere you've wandered
  | "waysReport" // post a ways report
  | "discoveryGuides"; // steer the discovery taste

/** Features that require Yonder+. Anything not here is free. */
export const PLUS_FEATURES: Record<FeatureKey, boolean> = {
  freeRoam: true,
  maps: true,
  missionsBrowse: true,
  createMission: true,
  customMedals: true,
  heatmap: true,
  waysReport: true,
  discoveryGuides: true,
};

export type MeterKey = "missionAttempts";

/** Free-tier allowances per period (Yonder+ is unlimited). */
export const METERS: Record<MeterKey, { free: number; period: "month" }> = {
  // Attempting a mission someone sent you: a taste before Yonder+.
  missionAttempts: { free: 3, period: "month" },
};

/** A short, human reason for the paywall sheet, per feature. */
export const FEATURE_REASON: Record<FeatureKey, string> = {
  freeRoam: "Free-roam wandering is a Yonder+ extra. The wander to a place is always free.",
  maps: "Maps are a Yonder+ extra, build and walk sets of places.",
  missionsBrowse: "Browsing missions is a Yonder+ extra.",
  createMission: "Publishing a mission is a Yonder+ extra.",
  customMedals: "Custom medal thresholds are a Yonder+ extra.",
  heatmap: "Your exploration heatmap is a Yonder+ extra.",
  waysReport: "Ways reports are a Yonder+ extra.",
  discoveryGuides: "Discovery guides are a Yonder+ extra.",
};
