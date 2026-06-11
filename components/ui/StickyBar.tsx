import type { ReactNode } from "react";

// Pins its children to the top of the scrolling <main> as the page scrolls, so
// the big title above can scroll away while tabs (and search) stay reachable.
// Full-bleed backdrop (negative margin cancels the page's px-5) hides the
// content sliding under it.
export default function StickyBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky top-0 z-20 -mx-5 px-5 pt-3 pb-2.5 bg-[var(--background)]/85 backdrop-blur-md">
      {children}
    </div>
  );
}
