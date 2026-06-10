import { describe, expect, it } from "vitest";
import { makeTravelBearing } from "./geo";

describe("makeTravelBearing", () => {
  it("reads a straight northward walk as bearing ~0 with high confidence", () => {
    const tb = makeTravelBearing();
    let lat = 51.5;
    for (let i = 0; i < 12; i++) {
      tb.push({ lat, lon: -0.1 });
      lat += 0.0001; // ~11 m steps due north
    }
    const { bearing, confidence } = tb.value();
    expect(bearing).not.toBeNull();
    expect(Math.abs(bearing!)).toBeLessThan(8);
    expect(confidence).toBeGreaterThan(0.9);
  });

  it("averages around the 360 wrap without flipping to 180", () => {
    const tb = makeTravelBearing({ halfLifeM: 1e9 });
    let lat = 51.5;
    let lon = -0.1;
    let n = true;
    for (let i = 0; i < 10; i++) {
      lat += n ? 0.00012 : 0.0001;
      lon += n ? 0.00002 : -0.00002;
      tb.push({ lat, lon });
      n = !n;
    }
    const b = tb.value().bearing!;
    expect(b < 45 || b > 315).toBe(true);
  });

  it("ignores sub-minStepM jitter so a standstill doesn't corrupt the heading", () => {
    const tb = makeTravelBearing();
    tb.push({ lat: 51.5, lon: -0.1 });
    const before = tb.value();
    tb.push({ lat: 51.5 + 0.00001, lon: -0.1 }); // ~1.1 m
    expect(tb.value()).toBe(before);
  });

  it("starts unknown and resets to unknown", () => {
    const tb = makeTravelBearing();
    expect(tb.value()).toEqual({ bearing: null, confidence: 0 });
    tb.push({ lat: 51.5, lon: -0.1 });
    tb.push({ lat: 51.6, lon: -0.1 });
    expect(tb.value().bearing).not.toBeNull();
    tb.reset();
    expect(tb.value()).toEqual({ bearing: null, confidence: 0 });
  });
});
