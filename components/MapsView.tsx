"use client";
import { Map as MapIcon, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState, PageHeader, PageScaffold } from "@/components/ui";
import { DotMap } from "@/components/ui/viz";
import { useAuthUser } from "@/lib/auth";
import { loadMaps } from "@/lib/data";
import { toUnitBox } from "@/lib/geo";
import type { StoredMap } from "@/lib/types";

function mapSubtitle(m: StoredMap): string {
  const remaining = m.items.filter((i) => !i.visited).length;
  const total = m.items.length;
  const shape = m.mode === "ordered" ? "Step through" : "Wander between";
  const count =
    total === 0
      ? "no places"
      : remaining === 0
        ? "all seen"
        : remaining === total
          ? `${total} place${total === 1 ? "" : "s"}`
          : `${remaining} of ${total} left`;
  return `${shape} · ${count}`;
}

export default function MapsView() {
  const [maps, setMaps] = useState<StoredMap[] | null>(null);
  const { user } = useAuthUser();

  useEffect(() => {
    let cancelled = false;
    void loadMaps().then((m) => {
      if (!cancelled) setMaps(m);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <PageScaffold>
      <PageHeader
        kicker="Maps"
        title="Your maps"
        action={
          <Link
            href="/maps/new"
            aria-label="New map"
            className="size-9 rounded-full bg-[var(--accent)] text-black flex items-center justify-center active:opacity-80"
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
          </Link>
        }
      />

      {maps === null ? null : maps.length === 0 ? (
        <EmptyState
          icon={MapIcon}
          title="No maps yet"
          body="A map is a set of places to wander between — any time, over as many days as you like. Make one and keep it."
          action={
            <Link
              href="/maps/new"
              className="rounded-full bg-[var(--accent)] text-black font-semibold px-5 py-2.5 active:opacity-80"
            >
              Build a map
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {maps.map((m) => (
            <li key={m.id}>
              <Link
                href={`/maps/${m.id}`}
                className="block rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden hover:border-[var(--accent)]/50 transition-colors"
              >
                <div className="px-4 pt-4 pb-1">
                  <div className="font-display text-xl tracking-tight truncate">
                    {m.name}
                  </div>
                  <div className="text-xs text-[var(--warm)] mt-0.5">
                    {mapSubtitle(m)}
                  </div>
                </div>
                {m.items.length > 0 && (
                  <DotMap points={toUnitBox(m.items)} height={120} />
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageScaffold>
  );
}
