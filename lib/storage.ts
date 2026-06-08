"use client";
import type { SavedYonder } from "./types";

const KEYS = {
  yonders: "vibe-yonder.yonders.v1",
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

export function updateYonder(y: SavedYonder) {
  const all = loadYonders();
  const next = all.map((x) => (x.id === y.id ? y : x));
  write(KEYS.yonders, next);
}

export function clearYonders() {
  write(KEYS.yonders, []);
}
