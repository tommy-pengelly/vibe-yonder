"use client";

// The seen/skipped ledger for ambient discovery (Doc 7 Part E). One more term
// subtracted from a candidate's *draw*, a familiarity penalty, so the engine
// doesn't re-offer what you've already done or just waved off.
//
//  - SEEN (you visited / revealed it): a long-lived penalty, you know what it
//    is now, so it drops out of mystery surfacing.
//  - SKIPPED (offered, declined / passed by): decays with **distance travelled
//    since**, not time, so the café you just walked past won't nag, but it can
//    resurface on a later wander or if you loop back. Detours are features, so
//    we never hard-blacklist.
//
// On-device only. This is a trail of *what interested you and where*, sensitive
//, so it never leaves localStorage and is never serialized into a yonder or a
// shared object (Doc 3 privacy invariant).

const KEY = "vibe-yonder.discovery.v1";
const CAP = 200; // bounded; oldest evicted
const SEEN_PENALTY = 0.85;
const SKIP_BASE = 0.6;
const SKIP_COOLDOWN_M = 600; // metres travelled before a skip fully fades

export type LedgerEntry = {
  id: string;
  status: "seen" | "skipped";
  /** Wall-clock stamp (debug / recency); decay is distance-based, not this. */
  at: number;
  /** Cumulative metres walked when this was recorded, the decay anchor. */
  distAt: number;
};

function read(): LedgerEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LedgerEntry[]) : [];
  } catch {
    return [];
  }
}

function write(entries: LedgerEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // quota / privacy mode, silently ignore
  }
}

export function loadLedger(): LedgerEntry[] {
  return read();
}

function upsert(id: string, status: "seen" | "skipped", distAt: number) {
  const all = read();
  // Never downgrade a place you've actually seen back to merely "skipped".
  if (status === "skipped" && all.find((e) => e.id === id)?.status === "seen") {
    return;
  }
  const entry: LedgerEntry = { id, status, at: Date.now(), distAt };
  write([entry, ...all.filter((e) => e.id !== id)].slice(0, CAP));
}

export function markSeen(id: string, distTravelledM: number) {
  upsert(id, "seen", distTravelledM);
}

export function markSkipped(id: string, distTravelledM: number) {
  upsert(id, "skipped", distTravelledM);
}

/** Pure familiarity penalty (0–1) for one entry at the current travel distance. */
export function familiarityOf(entry: LedgerEntry, distTravelledNowM: number): number {
  if (entry.status === "seen") return SEEN_PENALTY;
  const since = distTravelledNowM - entry.distAt;
  return SKIP_BASE * Math.max(0, 1 - since / SKIP_COOLDOWN_M);
}

/** One-off lookup (reads storage). For per-tick scoring use makeFamiliarity. */
export function familiarity(id: string, distTravelledNowM: number): number {
  const e = read().find((x) => x.id === id);
  return e ? familiarityOf(e, distTravelledNowM) : 0;
}

/**
 * Snapshot the ledger once and return a `(id) => penalty` lookup, the shape
 * `score()`/`ScoreCtx.familiarity` wants, without hitting localStorage per
 * candidate. Rebuild it each scoring pass so the travel distance stays current.
 */
export function makeFamiliarity(distTravelledNowM: number): (id: string) => number {
  const map = new Map(read().map((e) => [e.id, e] as const));
  return (id) => {
    const e = map.get(id);
    return e ? familiarityOf(e, distTravelledNowM) : 0;
  };
}

export function clearLedger() {
  write([]);
}
