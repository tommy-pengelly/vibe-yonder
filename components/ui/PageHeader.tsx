import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

// The standard member-screen header: an uppercase tracked kicker + a Fraunces
// title, with an optional back chevron (left) and a single action slot (right).
// Replaces every hand-rolled <header>.
export default function PageHeader({
  kicker,
  title,
  backHref,
  action,
}: {
  kicker?: string;
  title: ReactNode;
  backHref?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {backHref && (
          <Link
            href={backHref}
            aria-label="Back"
            className="size-9 -ml-2 rounded-full flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] shrink-0"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
          </Link>
        )}
        <div className="min-w-0">
          {kicker && (
            <span className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
              {kicker}
            </span>
          )}
          <h1 className="font-display text-3xl tracking-tight leading-none truncate">
            {title}
          </h1>
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
