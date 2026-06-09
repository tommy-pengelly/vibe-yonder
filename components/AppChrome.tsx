"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import BootSplash from "./BootSplash";
import BottomNav from "./BottomNav";

// Routes that are full-screen immersive takeovers, no persistent nav.
const IMMERSIVE = new Set(["/walk"]);

/**
 * App shell. The bottom nav lives here (in the layout), so it stays mounted and
 * always visible across navigations, native-app style, instead of being
 * re-rendered by every page. The scrollable content sits in <main> so an error
 * or 404 boundary can replace just the content while the nav stays put.
 */
export default function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const immersive = IMMERSIVE.has(pathname);
  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      <main className="flex-1 overflow-y-auto flex flex-col">{children}</main>
      {!immersive && <BottomNav />}
      <BootSplash />
    </div>
  );
}
