// Deterministic in-app navigation depth.
//
// `window.history.length` only ever grows (router.back() moves the pointer, it
// doesn't shrink the length), so it can't answer "is there an in-app entry to
// pop back to?". We answer it ourselves by instrumenting the History API: every
// push/replace (Next's own included) and every browser back/forward is observed,
// so no call site has to opt in and none can drift out of sync.
//
// Each entry is stamped with an incrementing __navId in history.state, mapped to
// the depth it sits at. On popstate we read the landed entry's __navId and
// recover its exact depth, so browser back/forward stays correct too. A full
// reload resets depth to 0 (the current entry is re-stamped at 0), which is the
// behaviour we want: a cold/deep-linked open has nothing in-app to pop, so back
// goes "up" via the screen's declared fallback.

import type { useRouter } from "next/navigation";

type Router = ReturnType<typeof useRouter>;
type NavState = Record<string, unknown> & { __navId?: number };

let depth = 0;
let seq = 0;
let currentNavId = 0;
const depthByNavId = new Map<number, number>([[0, 0]]);
let installed = false;

function stamp(state: unknown, id: number): NavState {
  return state && typeof state === "object"
    ? { ...(state as NavState), __navId: id }
    : { __navId: id };
}

/** Patch the History API once, at app boot (mounted via <NavTracker/>). */
export function installNavTracker(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const h = window.history;
  const origPush = h.pushState.bind(h);
  const origReplace = h.replaceState.bind(h);

  // Stamp the entry we booted on as depth 0.
  origReplace(stamp(h.state, 0), "");
  currentNavId = 0;
  depthByNavId.set(0, 0);

  h.pushState = function (state, unused, url) {
    seq += 1;
    const id = seq;
    const d = depth + 1;
    origPush(stamp(state, id), unused, url);
    depth = d;
    currentNavId = id;
    depthByNavId.set(id, d);
  };

  h.replaceState = function (state, unused, url) {
    // Swap the current entry in place: depth is unchanged, keep its navId.
    const id = currentNavId;
    origReplace(stamp(state, id), unused, url);
    depthByNavId.set(id, depth);
  };

  window.addEventListener("popstate", () => {
    const id = (h.state as NavState | null)?.__navId;
    if (typeof id === "number" && depthByNavId.has(id)) {
      depth = depthByNavId.get(id)!;
      currentNavId = id;
    } else {
      // An entry from before instrumentation (e.g. behind a reloaded page).
      // Best effort; our own buttons never call back() from depth 0 anyway.
      depth = Math.max(0, depth - 1);
    }
  });
}

/** In-app navigations deep since cold open. 0 means "opened cold here". */
export function navDepth(): number {
  return depth;
}

/**
 * Go back one in-app level: pop history when there's a real entry to pop,
 * otherwise (cold/deep-link open) push the screen's declared parent.
 */
export function goBack(router: Router, fallback = "/"): void {
  if (depth > 0) router.back();
  else router.push(fallback);
}
