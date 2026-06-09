"use client";
import { Compass, Home, Map as MapIcon, Telescope, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BottomNav() {
  const pathname = usePathname();
  const active = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  return (
    <nav
      aria-label="Primary"
      className="relative z-20 shrink-0 grid grid-cols-5 items-center px-2 py-2.5 bg-[var(--background)]/85 backdrop-blur-md border-t border-[var(--border)]"
    >
      <Tab href="/" label="Feed" Icon={Home} active={active("/")} />
      <Tab href="/maps" label="Maps" Icon={MapIcon} active={active("/maps")} />

      <div className="flex justify-center">
        <Link
          href="/walk"
          aria-label="Begin a yonder"
          className="size-14 -mt-6 rounded-full bg-[var(--accent)] text-black flex items-center justify-center shadow-lg shadow-black/40 active:opacity-80"
        >
          <Telescope className="w-6 h-6" strokeWidth={2} />
        </Link>
      </div>

      <Tab href="/explore" label="Find" Icon={Compass} active={active("/explore")} />
      <Tab href="/you" label="Me" Icon={User} active={active("/you")} />
    </nav>
  );
}

function Tab({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon: typeof Home;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center gap-0.5 px-1 py-1 text-[11px] ${
        active ? "text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
      }`}
    >
      <Icon className="w-5 h-5" strokeWidth={1.75} />
      <span className="tracking-wide">{label}</span>
    </Link>
  );
}
