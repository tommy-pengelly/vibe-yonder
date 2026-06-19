"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import BootSplash from "./BootSplash";
import BottomNav from "./BottomNav";
import NavTracker from "./NavTracker";
import PaywallProvider from "./PaywallProvider";

// The bottom nav lives ONLY on the three roots. Everything else is a one-layer
// overlay you exit with its back/X (which pops to the root you came from), so a
// stack can't pile up by tab-hopping between sections (there's no ⊕ inside
// /maps etc. to push a fresh home). Every non-root screen has a back affordance.
const ROOTS = new Set(["/", "/community", "/you"]);

/**
 * App shell. The bottom nav lives here (in the layout), so it stays mounted and
 * always visible across navigations, native-app style, instead of being
 * re-rendered by every page. The scrollable content sits in <main> so an error
 * or 404 boundary can replace just the content while the nav stays put.
 */
export default function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const showNav = ROOTS.has(pathname);
  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      <NavTracker />
      <PaywallProvider>
        <main className="flex-1 overflow-y-auto flex flex-col">{children}</main>
      </PaywallProvider>
      {showNav && <BottomNav />}
      <BootSplash />
    </div>
  );
}
