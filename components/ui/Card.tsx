import Link from "next/link";
import type { ReactNode } from "react";

// The standard surface: a soft-bordered rounded panel. Renders as a Link, a
// button, or a plain div depending on the props. Interactive (link/button)
// surfaces get the accent-on-hover by default. Don't hand-roll
// `rounded-2xl border bg-surface` anywhere, use this.
export default function Card({
  href,
  onClick,
  children,
  className = "",
  interactive,
  disabled,
}: {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  /** Override the hover treatment (defaults on for link/button surfaces). */
  interactive?: boolean;
  disabled?: boolean;
}) {
  const act = interactive ?? (!!href || !!onClick);
  const base = `rounded-2xl border border-[var(--border)] bg-[var(--surface)] ${
    act && !disabled ? "hover:border-[var(--accent)]/50 transition-colors" : ""
  } ${className}`;

  if (href && !disabled) {
    return (
      <Link href={href} className={base}>
        {children}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`${base} w-full text-left disabled:opacity-40`}
      >
        {children}
      </button>
    );
  }
  return <div className={base}>{children}</div>;
}
