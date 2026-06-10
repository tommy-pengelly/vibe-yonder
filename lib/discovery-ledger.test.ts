import { beforeEach, describe, expect, it } from "vitest";
import {
  clearLedger,
  familiarity,
  loadLedger,
  makeFamiliarity,
  markSeen,
  markSkipped,
} from "./discovery-ledger";

// The ledger reads window.localStorage at call time — shim it with a Map so
// these stay pure unit tests (no jsdom dependency).
beforeEach(() => {
  const store = new Map<string, string>();
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => store.set(k, v),
    },
  };
});

describe("familiarity / seen", () => {
  it("is a strong constant penalty regardless of distance", () => {
    markSeen("a", 0);
    expect(familiarity("a", 0)).toBe(0.85);
    expect(familiarity("a", 5000)).toBe(0.85);
  });
});

describe("familiarity / skipped decays with distance travelled", () => {
  it("starts at the base penalty and fades linearly to zero", () => {
    markSkipped("b", 1000);
    expect(familiarity("b", 1000)).toBeCloseTo(0.6, 9); // fresh
    expect(familiarity("b", 1300)).toBeCloseTo(0.3, 9); // half a 600 m cooldown
    expect(familiarity("b", 1600)).toBe(0); // fully faded
    expect(familiarity("b", 9999)).toBe(0); // never negative
  });
});

describe("ledger rules", () => {
  it("does not downgrade a seen place to skipped", () => {
    markSeen("a", 0);
    markSkipped("a", 100);
    expect(familiarity("a", 100)).toBe(0.85);
  });

  it("has no penalty for an unknown id", () => {
    expect(familiarity("zzz", 0)).toBe(0);
  });

  it("is bounded — oldest entries are evicted past the cap", () => {
    for (let i = 0; i < 250; i++) markSeen("x" + i, i);
    expect(loadLedger()).toHaveLength(200);
    expect(familiarity("x249", 0)).toBe(0.85); // newest kept
    expect(familiarity("x0", 0)).toBe(0); // oldest gone
  });

  it("clears", () => {
    markSeen("a", 0);
    clearLedger();
    expect(loadLedger()).toHaveLength(0);
  });
});

describe("makeFamiliarity snapshot", () => {
  it("matches per-call familiarity for a fixed distance", () => {
    markSkipped("b", 1000);
    markSeen("a", 0);
    const fam = makeFamiliarity(1300);
    expect(fam("b")).toBeCloseTo(0.3, 9);
    expect(fam("a")).toBe(0.85);
    expect(fam("unknown")).toBe(0);
  });
});
