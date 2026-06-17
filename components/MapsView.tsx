"use client";
import {
  Map as MapIcon,
  MoreVertical,
  Navigation,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BottomSheet, EmptyState, PageHeader, PageScaffold } from "@/components/ui";
import { DotMap } from "@/components/ui/viz";
import { useAuthUser } from "@/lib/auth";
import { deleteMap, loadMaps } from "@/lib/data";
import { fmtDist, spanMeters, toUnitBox } from "@/lib/geo";
import type { StoredMap, Target } from "@/lib/types";

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
  const [actionMap, setActionMap] = useState<StoredMap | null>(null);
  const router = useRouter();
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

  const startYonder = (m: StoredMap) => {
    if (typeof window === "undefined") return;
    const active = m.items.filter((i) => !i.visited);
    if (active.length === 0) return;
    const targets: Target[] = active.map((i) => ({
      id: crypto.randomUUID(),
      name: i.name,
      label: i.label,
      lat: i.lat,
      lon: i.lon,
      visited: false,
    }));
    const mapItemIdByTargetId: Record<string, string> = {};
    targets.forEach((t, k) => (mapItemIdByTargetId[t.id] = active[k].id));
    window.sessionStorage.setItem(
      "vibe-yonder.start",
      JSON.stringify({
        mode: targets.length === 1 ? "single" : m.mode,
        targets,
        mapId: m.id,
        mapItemIdByTargetId,
        name: m.name,
      }),
    );
    router.push("/walk");
  };

  const onDelete = async (m: StoredMap) => {
    setActionMap(null);
    setMaps((prev) => (prev ?? []).filter((x) => x.id !== m.id));
    await deleteMap(m.id);
  };

  const allSeen = actionMap
    ? actionMap.items.length > 0 &&
      actionMap.items.every((i) => i.visited)
    : false;

  return (
    <PageScaffold>
      <PageHeader
        kicker="Maps"
        title="Your maps"
        backHref="/"
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
          body="A map is a set of places to wander between, any time, over as many days as you like. Make one and keep it."
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
            <li key={m.id} className="relative">
              <Link
                href={`/maps/${m.id}`}
                className="block rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden hover:border-[var(--accent)]/50 transition-colors"
              >
                <div className="px-4 pt-4 pb-1 pr-12">
                  <div className="flex items-center gap-2">
                    <div className="font-display text-xl tracking-tight truncate">
                      {m.name}
                    </div>
                    {m.visibility === "public" && (
                      <span className="shrink-0 text-[9px] uppercase tracking-widest text-[var(--accent)] border border-[var(--accent)]/40 rounded-full px-1.5 py-0.5">
                        Shared
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--warm)] mt-0.5">
                    {mapSubtitle(m)}
                  </div>
                </div>
                {m.items.length > 0 && (
                  <DotMap
                    points={toUnitBox(m.items)}
                    height={120}
                    scaleLabel={
                      m.items.length > 1
                        ? `${fmtDist(spanMeters(m.items))} across`
                        : undefined
                    }
                  />
                )}
              </Link>
              <button
                type="button"
                onClick={() => setActionMap(m)}
                aria-label={`Actions for ${m.name}`}
                className="absolute top-3 right-3 size-8 rounded-full flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] bg-[var(--background)]/40"
              >
                <MoreVertical className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <BottomSheet
        open={!!actionMap}
        onClose={() => setActionMap(null)}
        title={actionMap?.name}
      >
        {actionMap && (
          <div className="flex flex-col">
            <ActionRow
              icon={Navigation}
              label={allSeen ? "All seen" : "Yonder this map"}
              disabled={allSeen}
              onClick={() => {
                const m = actionMap;
                setActionMap(null);
                startYonder(m);
              }}
            />
            <ActionRow
              icon={Pencil}
              label="Edit"
              onClick={() => {
                const id = actionMap.id;
                setActionMap(null);
                router.push(`/maps/${id}/edit`);
              }}
            />
            <ActionRow
              icon={Trash2}
              label="Delete"
              danger
              onClick={() => void onDelete(actionMap)}
            />
          </div>
        )}
      </BottomSheet>
    </PageScaffold>
  );
}

function ActionRow({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: typeof Pencil;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-3 py-3.5 text-left border-b border-[var(--border)] last:border-0 disabled:opacity-40 ${
        danger ? "text-red-400" : "text-[var(--foreground)] hover:text-[var(--accent)]"
      }`}
    >
      <Icon className="w-5 h-5 shrink-0" strokeWidth={1.75} />
      <span className="font-display text-lg">{label}</span>
    </button>
  );
}
