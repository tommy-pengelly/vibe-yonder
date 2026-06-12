"use client";
import { useState } from "react";

// Tab/UI state that survives leaving the page and coming back (session-scoped),
// so e.g. the Community / Me tab you were on is restored when you return.
export function usePersistedState<T extends string>(
  key: string,
  fallback: T,
): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return fallback;
    return (window.sessionStorage.getItem(key) as T) || fallback;
  });
  const set = (next: T) => {
    setValue(next);
    if (typeof window !== "undefined") window.sessionStorage.setItem(key, next);
  };
  return [value, set];
}
