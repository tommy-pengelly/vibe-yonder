import { describe, expect, it } from "vitest";
import { matchFavourites, mergeFavouritesFirst, rankResults } from "./rank";
import type { FavouritePlace, GeocodeResult } from "./types";

const me = { lat: 51.5, lon: -0.12 };

function geo(name: string, lat: number, lon: number, importance: number): GeocodeResult {
  return { name, label: name, lat, lon, importance };
}

describe("rankResults — local bias", () => {
  it("ranks the near place above the far, more 'important' one", () => {
    const near = geo("Corner café", 51.501, -0.12, 0.2); // ~110 m
    const far = geo("Famous café", 51.6, -0.12, 0.9); // ~11 km
    const out = rankResults([far, near], me);
    expect(out[0].name).toBe("Corner café");
  });

  it("passes results through unchanged when there is no position", () => {
    const a = geo("A", 51.5, -0.12, 0.9);
    const b = geo("B", 51.6, -0.12, 0.1);
    expect(rankResults([a, b], null)).toEqual([a, b]);
  });
});

describe("matchFavourites — alias resolution", () => {
  const favs: FavouritePlace[] = [
    { id: "1", name: "12 Acacia Avenue", lat: 51.5, lon: -0.12, createdAt: 0, alias: "Home" },
    { id: "2", name: "Acme Corp", lat: 51.51, lon: -0.13, createdAt: 0, alias: "Work" },
    { id: "3", name: "Blue Bottle", lat: 51.52, lon: -0.14, createdAt: 0 },
  ];

  it("resolves an alias like 'home' to the saved place, leading with the alias", () => {
    const out = matchFavourites("home", favs, me);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Home");
    expect(out[0].label).toBe("12 Acacia Avenue");
    expect(out[0].favourite).toBe(true);
  });

  it("matches a partial alias prefix", () => {
    expect(matchFavourites("wo", favs, me)[0].name).toBe("Work");
  });

  it("falls back to the place name when there is no alias", () => {
    expect(matchFavourites("blue", favs, me)[0].name).toBe("Blue Bottle");
  });

  it("returns nothing for an empty query or no matches", () => {
    expect(matchFavourites("", favs, me)).toEqual([]);
    expect(matchFavourites("zzz", favs, me)).toEqual([]);
  });

  it("ranks an exact alias above a mere contains-match", () => {
    const two: FavouritePlace[] = [
      { id: "a", name: "Homebase DIY", lat: 51.5, lon: -0.12, createdAt: 0 },
      { id: "b", name: "Flat", lat: 51.5, lon: -0.12, createdAt: 0, alias: "Home" },
    ];
    expect(matchFavourites("home", two, me)[0].name).toBe("Home");
  });
});

describe("mergeFavouritesFirst", () => {
  it("puts favourites first and drops a geocode hit at the same spot", () => {
    const fav = matchFavourites("home", [
      { id: "1", name: "12 Acacia Avenue", lat: 51.5, lon: -0.12, createdAt: 0, alias: "Home" },
    ], me);
    const geocode = rankResults(
      [geo("12 Acacia Avenue", 51.5, -0.12, 0.5), geo("Somewhere else", 51.6, -0.2, 0.5)],
      me,
    );
    const merged = mergeFavouritesFirst(fav, geocode);
    expect(merged[0].favourite).toBe(true);
    expect(merged).toHaveLength(2); // the duplicate spot is dropped
    expect(merged[1].name).toBe("Somewhere else");
  });

  it("returns the geocode list untouched when there are no favourite matches", () => {
    const geocode = rankResults([geo("A", 51.5, -0.12, 0.5)], me);
    expect(mergeFavouritesFirst([], geocode)).toEqual(geocode);
  });
});
