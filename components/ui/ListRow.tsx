import Link from "next/link";
import type { ReactNode } from "react";

// The repeated "leading · title/subtitle · trailing" row (Maps, MapDetail,
// search results, favourites). Renders as a Link, a button, or a plain row.
export default function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  href,
  onClick,
  disabled,
  className = "",
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const inner = (
    <>
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        <div className="font-display text-lg truncate">{title}</div>
        {subtitle && (
          <div className="text-xs text-[var(--muted)] mt-0.5 truncate">
            {subtitle}
          </div>
        )}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </>
  );

  const base = `w-full flex items-center gap-3 py-3 text-left ${
    disabled ? "opacity-40" : "hover:text-[var(--accent)]"
  } ${className}`;

  if (href && !disabled) {
    return (
      <Link href={href} className={base}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={base}>
      {inner}
    </button>
  );
}
