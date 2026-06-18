import type { ReactNode } from "react";
import Card from "./Card";

// A browse-list item: a Card with a title + meta header and a viz beneath, the
// whole thing tapping into a detail screen. The standard shape for Maps and
// Missions lists (viz = DotMap scatter / MissionLineViz line). An optional
// top-right `action` (e.g. a kebab) overlays the card.
export default function BrowseCard({
  href,
  title,
  meta,
  badge,
  viz,
  action,
}: {
  href: string;
  title: ReactNode;
  meta?: ReactNode;
  badge?: ReactNode;
  viz?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="relative">
      <Card href={href} className="block overflow-hidden">
        <div className={`px-4 pt-4 pb-1 ${action ? "pr-12" : ""}`}>
          <div className="flex items-center gap-2">
            <div className="font-display text-xl tracking-tight truncate">{title}</div>
            {badge}
          </div>
          {meta && <div className="text-xs text-[var(--warm)] mt-0.5">{meta}</div>}
        </div>
        {viz}
      </Card>
      {action && <div className="absolute top-3 right-3">{action}</div>}
    </div>
  );
}
