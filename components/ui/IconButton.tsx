import Link from "next/link";
import type { LucideIcon } from "lucide-react";

// A round icon button (the size-9 circle used for header actions, sheet
// closes, the + create action). `ghost` is the quiet default; `filled` is the
// amber primary (e.g. the + on a browse screen). Renders as a Link or button.
export default function IconButton({
  icon: Icon,
  label,
  onClick,
  href,
  variant = "ghost",
  className = "",
}: {
  icon: LucideIcon;
  /** Accessible label (aria-label). */
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: "ghost" | "filled";
  className?: string;
}) {
  const styles =
    variant === "filled"
      ? "bg-[var(--accent)] text-black active:opacity-80"
      : "text-[var(--muted)] hover:text-[var(--foreground)]";
  const base = `size-9 rounded-full flex items-center justify-center shrink-0 ${styles} ${className}`;
  const inner = <Icon className="w-4 h-4" strokeWidth={variant === "filled" ? 2 : 1.75} />;
  if (href) {
    return (
      <Link href={href} aria-label={label} className={base}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-label={label} className={base}>
      {inner}
    </button>
  );
}
