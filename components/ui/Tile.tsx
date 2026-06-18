import type { ReactNode } from "react";

// A labelled stat tile (uppercase micro-label + a big Fraunces value). `hero`
// fills the surface and turns the value amber. Used on the recap, mission
// scoreboard, and the Me stats, anywhere a number is shown with a caption.
export default function Tile({
  label,
  value,
  hero,
}: {
  label: string;
  value: ReactNode;
  hero?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-[var(--border)] px-4 py-4 flex flex-col ${
        hero ? "bg-[var(--surface)]" : "bg-transparent"
      }`}
    >
      <div className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
        {label}
      </div>
      <div
        className={`font-display tabular-nums mt-1 ${
          hero ? "text-3xl text-[var(--accent)]" : "text-2xl"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
