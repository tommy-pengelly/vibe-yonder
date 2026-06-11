// Single source of truth for tunable behaviour. Keep in metres / ms / px.

/** Arrival chip fires when an unvisited target is within this distance. */
export const ARRIVAL_RADIUS_M = 25;

/** Multiplier on ARRIVAL_RADIUS_M before a dismissed chip can re-fire. */
export const ARRIVAL_REARM_RATIO = 1.6;

/** Below this total walked distance, finishing a yonder skips the recap. */
export const TRIVIAL_WALK_M = 5;

/** Track recording throttle, only add a fix if the position changed by this. */
export const MIN_FIX_DISTANCE_M = 3;

/** Track recording throttle, or this much time has passed since last fix. */
export const MIN_FIX_INTERVAL_MS = 3000;

/** Default scope zoom (metres per pixel). */
export const DEFAULT_MPP = 0.6;

/** Scope zoom clamp. */
export const MIN_MPP = 0.12;
export const MAX_MPP = 12;

/** Discrete scale levels (metres) the scope snaps to on gesture end. */
export const SCALE_LEVELS_M = [25, 50, 100, 250, 500, 1000, 2500, 5000];

/** Where the rim sits on the canvas as a fraction of min(w, h). */
export const RIM_FRACTION = 0.42;

/** In-circle dot fade begins at this fraction of the rim radius. */
export const FADE_START = 0.7;
