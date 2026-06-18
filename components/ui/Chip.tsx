import type { ReactNode } from "react";

// A rounded-full pill: a toggle (when onClick) or a static tag (a span). Used
// for filters, modes, quick-launch places, and small labels.
export default function Chip({
  active,
  onClick,
  children,
  className = "",
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  const base = `rounded-full border px-3.5 py-2 text-sm whitespace-nowrap transition-colors ${
    active
      ? "border-[var(--accent)] text-[var(--accent)]"
      : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
  } ${className}`;
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-pressed={active} className={base}>
        {children}
      </button>
    );
  }
  return <span className={base}>{children}</span>;
}
