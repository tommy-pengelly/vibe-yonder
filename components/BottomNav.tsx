"use client";
import { Compass, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; Icon: typeof Compass };

const ITEMS: Item[] = [
  { href: "/", label: "Explore", Icon: Compass },
  { href: "/you", label: "You", Icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <nav
      aria-label="Primary"
      className="sticky bottom-0 z-20 flex items-center justify-around gap-2 px-6 py-3 bg-[var(--background)]/85 backdrop-blur-md border-t border-[var(--border)]"
    >
      {ITEMS.map(({ href, label, Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] ${
              active
                ? "text-[var(--accent)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            <Icon className="w-5 h-5" strokeWidth={1.75} />
            <span className="tracking-wide">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
