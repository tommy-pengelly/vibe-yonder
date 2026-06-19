"use client";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { goBack } from "@/lib/nav";

// The standard member-screen header: an uppercase tracked kicker + a Fraunces
// title, with an optional back chevron (left) and a single action slot (right).
// Back returns to wherever you came from in-app (history), falling back to
// `backHref` only when the page was opened directly.
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
  const router = useRouter();
  const onBack = () => goBack(router, backHref ?? "/");
  return (
    <header className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {backHref && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="size-9 -ml-2 rounded-full flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] shrink-0"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
          </button>
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
