"use client";
import type {
  FavouritePlace,
  ListItemState,
  SavedYonder,
  StoredList,
} from "./types";

const KEYS = {
  yonders: "vibe-yonder.yonders.v1",
  lists: "vibe-yonder.lists.v1",
  favourites: "vibe-yonder.favourites.v1",
  draftList: "vibe-yonder.draft-list.v1",
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

export function loadYonders(): SavedYonder[] {
  return read<SavedYonder[]>(KEYS.yonders, []);
}

export function pushYonder(y: SavedYonder) {
  const all = loadYonders();
  const next = [y, ...all].slice(0, 30);
  write(KEYS.yonders, next);
}

export function clearYonders() {
  write(KEYS.yonders, []);
}

export function loadFavourites(): FavouritePlace[] {
  return read<FavouritePlace[]>(KEYS.favourites, []);
}

export function toggleFavourite(p: Omit<FavouritePlace, "id" | "createdAt">) {
  const all = loadFavourites();
  const existing = all.find(
    (f) =>
      Math.abs(f.lat - p.lat) < 1e-6 &&
      Math.abs(f.lon - p.lon) < 1e-6 &&
      f.name === p.name,
  );
  if (existing) {
    const next = all.filter((f) => f.id !== existing.id);
    write(KEYS.favourites, next);
    return { favourited: false, list: next };
  }
  const fav: FavouritePlace = {
    ...p,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  const next = [fav, ...all];
  write(KEYS.favourites, next);
  return { favourited: true, list: next };
}

export function loadLists(): StoredList[] {
  return read<StoredList[]>(KEYS.lists, []);
}

export function saveList(list: StoredList) {
  const all = loadLists();
  const idx = all.findIndex((l) => l.id === list.id);
  const stamped = { ...list, updatedAt: Date.now() };
  const next = idx >= 0 ? all.map((l, i) => (i === idx ? stamped : l)) : [stamped, ...all];
  write(KEYS.lists, next);
}

export function deleteList(id: string) {
  const next = loadLists().filter((l) => l.id !== id);
  write(KEYS.lists, next);
}

export function newList(name: string, items: ListItemState[] = []): StoredList {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name,
    items,
    createdAt: now,
    updatedAt: now,
  };
}

export function loadDraftList(): ListItemState[] {
  return read<ListItemState[]>(KEYS.draftList, []);
}

export function saveDraftList(items: ListItemState[]) {
  write(KEYS.draftList, items);
}

export function clearDraftList() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEYS.draftList);
}
