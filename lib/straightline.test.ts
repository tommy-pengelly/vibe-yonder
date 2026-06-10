import { describe, expect, it } from "vitest";
import { crossTrack } from "./geo";
import { medalFor, scoreStraightLine } from "./straightline";

// A north–south line near London: A south of B at the same longitude.
const A = { lat: 51.5, lon: -0.1 };
const B = { lat: 51.52, lon: -0.1 };

describe("crossTrack", () => {
  it("is ~0 for a point on the line", () => {
    expect(Math.abs(crossTrack({ lat: 51.51, lon: -0.1 }, A, B))).toBeLessThan(1);
  });

  it("measures the perpendicular offset and flips sign by side", () => {
    // ~70 m east of the line at this latitude (1e-3 deg lon ≈ 69 m).
    const east = crossTrack({ lat: 51.51, lon: -0.099 }, A, B);
    const west = crossTrack({ lat: 51.51, lon: -0.101 }, A, B);
    expect(Math.abs(east)).toBeGreaterThan(50);
    expect(Math.abs(east)).toBeLessThan(90);
    expect(Math.sign(east)).toBe(-Math.sign(west));
  });
});

describe("medalFor", () => {
  it("maps worst deviation to a medal (corridor half-widths)", () => {
    expect(medalFor(10)).toBe("platinum");
    expect(medalFor(20)).toBe("gold");
    expect(medalFor(40)).toBe("silver");
    expect(medalFor(90)).toBe("bronze");
    expect(medalFor(150)).toBe("none");
  });
});

describe("scoreStraightLine", () => {
  it("a dead-straight walk is platinum with ~0 deviation", () => {
    const track = [];
    for (let i = 0; i <= 10; i++) track.push({ lat: 51.5 + i * 0.002, lon: -0.1 });
    const s = scoreStraightLine(track, A, B);
    expect(s.maxDeviation).toBeLessThan(2);
    expect(s.medal).toBe("platinum");
    expect(s.inCorridorPct).toBe(100);
  });

  it("the medal follows the worst point; avg stays the tiebreaker", () => {
    const track = [
      { lat: 51.505, lon: -0.1 }, // on line
      { lat: 51.51, lon: -0.1006 }, // ~40 m off → silver-band worst
      { lat: 51.515, lon: -0.1 }, // back on line
    ];
    const s = scoreStraightLine(track, A, B);
    expect(s.medal).toBe("silver");
    expect(s.avgDeviation).toBeLessThan(s.maxDeviation);
  });
});
