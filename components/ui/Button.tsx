import Link from "next/link";
import type { ReactNode } from "react";

// The standard action button. `primary` is the amber pill (one per screen),
// `secondary` the bordered pill, `ghost` plain text. Renders as a Link or a
// button. Don't hand-roll `rounded-full bg-accent ...` anywhere.
export default function Button({
  variant = "primary",
  onClick,
  href,
  disabled,
  children,
  className = "",
  type = "button",
}: {
  variant?: "primary" | "secondary" | "ghost";
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
  type?: "button" | "submit";
}) {
  const v = {
    primary: "bg-[var(--accent)] text-black font-semibold active:opacity-80",
    secondary:
      "border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]",
    ghost: "text-[var(--muted)] hover:text-[var(--foreground)]",
  }[variant];
  const base = `rounded-full py-3 px-5 inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:hover:border-[var(--border)] disabled:hover:text-[var(--foreground)] ${v} ${className}`;
  if (href && !disabled) {
    return (
      <Link href={href} className={base}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={base}>
      {children}
    </button>
  );
}
