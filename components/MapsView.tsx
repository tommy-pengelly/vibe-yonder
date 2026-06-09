"use client";
import { Map as MapIcon, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState, ListRow, PageHeader, PageScaffold } from "@/components/ui";
import { useAuthUser } from "@/lib/auth";
import { loadMaps } from "@/lib/data";
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
        title="Reusable yonders"
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
        <ul className="flex flex-col divide-y divide-[var(--border)]">
          {maps.map((m) => (
            <li key={m.id}>
              <ListRow
                href={`/maps/${m.id}`}
                title={m.name}
                subtitle={mapSubtitle(m)}
              />
            </li>
          ))}
        </ul>
      )}
    </PageScaffold>
  );
}
