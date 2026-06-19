"use client";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { goBack } from "@/lib/nav";

// Go back to wherever you came from in-app (pop history), falling back to a
// route only when the page was opened cold (no in-app entry to pop).
export function useGoBack(fallback = "/") {
  const router = useRouter();
  return useCallback(() => goBack(router, fallback), [router, fallback]);
}
