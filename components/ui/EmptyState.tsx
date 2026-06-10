import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

// An inviting empty state, centred, generous, with a clear primary action.
// Turns a lonely grey line into a prompt that sells the concept. Amber stays
// precious: the icon tile is muted; colour lives only in the action.
export default function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-5 px-6 py-16">
      {Icon && (
        <div className="size-14 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--muted)]">
          <Icon className="w-6 h-6" strokeWidth={1.5} />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-2xl tracking-tight">{title}</h2>
        <p className="text-sm text-[var(--muted)] leading-relaxed max-w-[18rem]">
          {body}
        </p>
      </div>
      {action}
    </div>
  );
}
