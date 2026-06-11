"use client";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

// Go back to wherever you came from in-app (pop history), falling back to a
// route only when the page was opened cold (no history to pop).
export function useGoBack(fallback = "/") {
  const router = useRouter();
  return useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  }, [router, fallback]);
}
