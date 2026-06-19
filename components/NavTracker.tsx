"use client";
import { useEffect } from "react";
import { installNavTracker } from "@/lib/nav";

// Installs the History API instrumentation once, as early as possible, so every
// navigation is counted from boot. Renders nothing.
export default function NavTracker() {
  useEffect(() => {
    installNavTracker();
  }, []);
  return null;
}
