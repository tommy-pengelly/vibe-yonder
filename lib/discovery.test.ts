import { describe, expect, it } from "vitest";
import {
  cellKey,
  coordId,
  notabilityTier,
  rankCandidates,
  score,
  type Candidate,
  type ScoreCtx,
} from "./discovery";

const ORIGIN = { lat: 51.5, lon: -0.1 };
const base = { name: "x", lon: -0.1, category: "cafe" };
const near: Candidate = { ...base, id: "near", lat: 51.5009 }; // ~100 m N
const far: Candidate = { ...base, id: "far", lat: 51.518 }; // ~2 km N, plain
const farWiki: Candidate = { ...base, id: "farwiki", lat: 51.518, wiki: "Q1" }; // ~2 km N, notable

const ctx = (over: Partial<ScoreCtx> = {}): ScoreCtx => ({
  origin: ORIGIN,
  travelBearing: null,
  confidence: 0,
  activeGuide: null,
  ...over,
});

describe("score / the distance gate", () => {
  it("prefers a near ordinary place over a far ordinary one", () => {
    expect(score(near, ctx()).value).toBeGreaterThan(score(far, ctx()).value);
  });

  it("gates a far ordinary place out but lets a far notable one survive", () => {
    expect(score(far, ctx()).surfaced).toBe(false);
    expect(score(farWiki, ctx()).surfaced).toBe(true);
  });
});

describe("score / direction (must be good to turn around for)", () => {
  const behind: Candidate = { ...base, id: "behind", lat: 51.4991 }; // ~100 m S
  it("penalises a place behind you only when you're committed to a heading", () => {
    const committed = score(behind, ctx({ travelBearing: 0, confidence: 1 }));
    const relaxed = score(behind, ctx({ travelBearing: 0, confidence: 0 }));
    expect(committed.value).toBeLessThan(relaxed.value);
  });
});

describe("score / guides lean but never blind", () => {
  it("lifts a matching category", () => {
    const g = ctx({ activeGuide: "pub" });
    expect(score({ ...near, category: "pub" }, g).value).toBeGreaterThan(
      score(near, g).value,
    );
  });
  it("still surfaces a notable non-guide place", () => {
    expect(score(farWiki, ctx({ activeGuide: "pub" })).surfaced).toBe(true);
  });
});

describe("score / independent over chain", () => {
  const indie: Candidate = { ...base, id: "indie", lat: 51.5009 };
  const chain: Candidate = { ...base, id: "chain", lat: 51.5009, chain: true };

  it("ranks an independent café above a chain at the same spot", () => {
    expect(score(indie, ctx()).value).toBeGreaterThan(score(chain, ctx()).value);
  });

  it("deprioritises but does not hide a near chain (still surfaces)", () => {
    expect(score(chain, ctx()).surfaced).toBe(true);
  });

  it("does NOT penalise a notable place that happens to be a brand (the Emirates)", () => {
    const landmark: Candidate = { ...base, id: "emirates", lat: 51.5009, chain: true, wiki: "Q", category: "history" };
    const plainChain: Candidate = { ...base, id: "outlet", lat: 51.5009, chain: true };
    expect(score(landmark, ctx()).value).toBeGreaterThan(score(plainChain, ctx()).value);
  });

  it("only penalises everyday amenities, not e.g. a branded viewpoint", () => {
    const brandedView: Candidate = { ...base, id: "v", lat: 51.5009, chain: true, category: "viewpoint" };
    const plainView: Candidate = { ...base, id: "v2", lat: 51.5009, category: "viewpoint" };
    expect(score(brandedView, ctx()).value).toBe(score(plainView, ctx()).value);
  });
});

describe("score / familiarity", () => {
  it("lowers draw for a familiar place", () => {
    const famCtx = ctx({ familiarity: (id) => (id === "near" ? 1 : 0) });
    expect(score(near, famCtx).value).toBeLessThan(score(near, ctx()).value);
  });
});

describe("notabilityTier (qualitative, never a number)", () => {
  it("tiers a wiki place and leaves a plain amenity untiered", () => {
    expect(notabilityTier(farWiki)).not.toBe("none");
    expect(notabilityTier(near)).toBe("none");
  });
});

describe("rankCandidates", () => {
  it("drops gated candidates and ranks the most notable first", () => {
    const ranked = rankCandidates([near, far, farWiki], ctx());
    expect(ranked.map((r) => r.id)).not.toContain("far");
    expect(ranked).toHaveLength(2);
    expect(ranked[0].id).toBe("farwiki");
  });

  it("respects the cap", () => {
    const many: Candidate[] = Array.from({ length: 10 }, (_, i) => ({
      ...base,
      id: `n${i}`,
      lat: 51.5 + i * 0.00005,
      wiki: "Q",
    }));
    expect(rankCandidates(many, ctx(), 6)).toHaveLength(6);
  });
});

describe("cellKey (tile, not tick)", () => {
  it("keeps nearby fixes in the same cell but separates distant ones", () => {
    const a = cellKey(51.5001, -0.1001);
    const b = cellKey(51.5004, -0.0998); // a few tens of metres away
    const c = cellKey(51.52, -0.1); // ~2 km away
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("coordId", () => {
  it("is stable for the same rounded coordinate", () => {
    expect(coordId({ lat: 51.500001, lon: -0.100001 })).toBe(
      coordId({ lat: 51.500002, lon: -0.100002 }),
    );
  });
});
