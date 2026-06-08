"use client";
import type {
  FavouritePlace,
  SavedYonder,
  StoredMap,
  StoredSaved,
} from "./types";

const KEYS = {
  yonders: "vibe-yonder.yonders.v1",
  favourites: "vibe-yonder.favourites.v1",
  maps: "vibe-yonder.maps.v1",
  saved: "vibe-yonder.saved.v1",
} as const;

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota / privacy mode — silently ignore
  }
}

// ----- Yonders -----
export function loadYonders(): SavedYonder[] {
  return read<SavedYonder[]>(KEYS.yonders, []);
}

export function pushYonder(y: SavedYonder) {
  const next = [y, ...loadYonders()].slice(0, 50);
  write(KEYS.yonders, next);
}

export function updateYonder(y: SavedYonder) {
  const next = loadYonders().map((x) => (x.id === y.id ? y : x));
  write(KEYS.yonders, next);
}

export function deleteYonder(id: string) {
  write(KEYS.yonders, loadYonders().filter((y) => y.id !== id));
}

export function getYonder(id: string): SavedYonder | null {
  return loadYonders().find((y) => y.id === id) ?? null;
}

export function clearYonders() {
  write(KEYS.yonders, []);
}

/** Wipe all guest data after a successful cloud import on first sign-in. */
export function clearGuestData() {
  write(KEYS.yonders, []);
  write(KEYS.favourites, []);
  write(KEYS.maps, []);
  write(KEYS.saved, []);
}

// ----- Favourites -----
export function loadFavourites(): FavouritePlace[] {
  return read<FavouritePlace[]>(KEYS.favourites, []);
}

export function pushFavourite(
  p: Omit<FavouritePlace, "id" | "createdAt">,
): FavouritePlace {
  const all = loadFavourites();
  const existing = all.find(
    (f) =>
      Math.abs(f.lat - p.lat) < 1e-6 &&
      Math.abs(f.lon - p.lon) < 1e-6 &&
      f.name === p.name,
  );
  if (existing) return existing;
  const fav: FavouritePlace = {
    ...p,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  write(KEYS.favourites, [fav, ...all]);
  return fav;
}

export function removeFavourite(id: string) {
  write(KEYS.favourites, loadFavourites().filter((f) => f.id !== id));
}

export function isFavourite(lat: number, lon: number, name: string): boolean {
  return getFavourite(lat, lon, name) != null;
}

export function getFavourite(
  lat: number,
  lon: number,
  name: string,
): FavouritePlace | null {
  return (
    loadFavourites().find(
      (f) =>
        Math.abs(f.lat - lat) < 1e-6 &&
        Math.abs(f.lon - lon) < 1e-6 &&
        f.name === name,
    ) ?? null
  );
}

// ----- Maps -----
export function loadMaps(): StoredMap[] {
  return read<StoredMap[]>(KEYS.maps, []);
}

export function getMap(id: string): StoredMap | null {
  return loadMaps().find((m) => m.id === id) ?? null;
}

export function saveMap(map: StoredMap) {
  const all = loadMaps();
  const idx = all.findIndex((m) => m.id === map.id);
  const stamped: StoredMap = { ...map, updatedAt: Date.now() };
  const next =
    idx >= 0 ? all.map((m, i) => (i === idx ? stamped : m)) : [stamped, ...all];
  write(KEYS.maps, next);
}

export function deleteMap(id: string) {
  write(KEYS.maps, loadMaps().filter((m) => m.id !== id));
}

// ----- Saved (save-for-later) -----
export function loadSaved(): StoredSaved[] {
  return read<StoredSaved[]>(KEYS.saved, []);
}

export function pushSaved(s: Omit<StoredSaved, "id" | "createdAt">): StoredSaved {
  const entry: StoredSaved = {
    ...s,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  write(KEYS.saved, [entry, ...loadSaved()]);
  return entry;
}

export function removeSaved(id: string) {
  write(KEYS.saved, loadSaved().filter((s) => s.id !== id));
}
