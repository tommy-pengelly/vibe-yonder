import type { ReactNode } from "react";

// The active-walk header: an amber kicker + a Fraunces title, with optional
// accessories beside the title (e.g. the favourite heart) and a right slot
// (e.g. suggestions + waypoints). Shared by WanderWalk and MissionWalk.
export default function WalkHeader({
  kicker,
  title,
  titleAccessory,
  right,
}: {
  kicker?: string | null;
  title: string;
  titleAccessory?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header className="relative z-10 flex items-start justify-between gap-3 px-5 pt-6 pointer-events-none">
      <div className="flex flex-col min-w-0 pointer-events-auto">
        {kicker && (
          <span className="text-[10px] uppercase tracking-widest text-[var(--accent)]/80">
            {kicker}
          </span>
        )}
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="font-display text-2xl tracking-tight leading-tight truncate">
            {title}
          </h1>
          {titleAccessory}
        </div>
      </div>
      {right && (
        <div className="shrink-0 flex items-center gap-2 pointer-events-auto">{right}</div>
      )}
    </header>
  );
}
