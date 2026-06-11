"use client";
import { ArrowLeft, Pencil, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import MapShareControl from "@/components/MapShareControl";
import PlacePhoto from "@/components/PlacePhoto";
import { useGoBack } from "@/components/ui";
import { DotMap, Traces } from "@/components/ui/viz";
import { useAuthUser } from "@/lib/auth";
import { deleteMap, getMap, loadYonders, saveMap } from "@/lib/data";
import { fmtDist, spanMeters, toUnitBox, toUnitBoxMulti } from "@/lib/geo";
import type { SavedYonder, StoredMap, Target } from "@/lib/types";

export default function MapDetail({ id }: { id: string }) {
  const router = useRouter();
  const goBack = useGoBack("/maps");
  const { user } = useAuthUser();
  const [map, setMap] = useState<StoredMap | null>(null);
  const [yonders, setYonders] = useState<SavedYonder[]>([]);
  const [seenOpen, setSeenOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getMap(id).then((m) => {
      if (!cancelled) setMap(m);
    });
    void loadYonders().then((ys) => {
      if (!cancelled) setYonders(ys.filter((y) => y.mapId === id));
    });
    return () => {
      cancelled = true;
    };
  }, [id, user]);

  if (!map) {
    return (
      <div className="flex-1 flex items-center justify-center px-5">
        <p className="text-sm text-[var(--muted)]">Map not found.</p>
      </div>
    );
  }

  // Owner of this map? Guests own their local maps (no ownerId); signed-in
  // users own maps whose ownerId matches. Non-owners get a read-only view of a
  // public map (no visited toggles, edit, delete or share).
  const isOwner = user ? map.ownerId === user.id : !map.ownerId;
  const remaining = map.items.filter((i) => !i.visited);
  const seen = map.items.filter((i) => i.visited);
  const allDone = map.items.length > 0 && remaining.length === 0;

  const markVisited = (itemId: string, visited: boolean) => {
    const next: StoredMap = {
      ...map,
      items: map.items.map((it) =>
        it.id === itemId
          ? { ...it, visited, visitedAt: visited ? Date.now() : undefined }
          : it,
      ),
    };
    setMap(next);
    void saveMap(next);
  };

  const startYonder = (fresh = false) => {
    if (typeof window === "undefined") return;
    // Resume: only the still-unvisited items. "Yonder again" (fresh) takes the
    // whole map for another go, leaving the completion record intact.
    const active =
      fresh || remaining.length === 0 ? map.items : map.items.filter((i) => !i.visited);
    const targets: Target[] = active.map((i) => ({
      id: crypto.randomUUID(),
      name: i.name,
      label: i.label,
      lat: i.lat,
      lon: i.lon,
      visited: false,
    }));
    const mapItemIdByTargetId: Record<string, string> = {};
    targets.forEach((t, k) => {
      mapItemIdByTargetId[t.id] = active[k].id;
    });
    window.sessionStorage.setItem(
      "vibe-yonder.start",
      JSON.stringify({
        mode: targets.length === 1 ? "single" : map.mode,
        targets,
        mapId: map.id,
        mapItemIdByTargetId,
        name: map.name,
      }),
    );
    router.push("/walk");
  };

  const onDelete = async () => {
    await deleteMap(map.id);
    router.push("/maps");
  };

  return (
    <>
      <div className="flex-1 flex flex-col w-full max-w-md mx-auto px-5 pt-8 pb-10 gap-6">
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={goBack}
              aria-label="Back"
              className="size-9 -ml-2 rounded-full flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] shrink-0"
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
            </button>
            <div className="min-w-0">
              <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
                {map.mode === "ordered" ? "Step through" : "Wander between"}
              </span>
              <h1 className="font-display text-3xl tracking-tight leading-none truncate">
                {map.name}
              </h1>
              <p className="text-sm text-[var(--warm)] mt-1">
                {isOwner
                  ? `${remaining.length} of ${map.items.length} left`
                  : `${map.items.length} ${map.items.length === 1 ? "place" : "places"} to wander`}
              </p>
            </div>
          </div>
        </header>

        {map.items.length > 0 && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
            <DotMap
              points={toUnitBox(map.items)}
              height={150}
              scaleLabel={
                map.items.length > 1
                  ? `${fmtDist(spanMeters(map.items))} across`
                  : undefined
              }
            />
          </div>
        )}

        {isOwner && yonders.length > 0 && (
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
                The ways you&apos;ve wandered here
              </span>
              <span className="text-[10px] text-[var(--muted)] tabular-nums">
                {yonders.length}
              </span>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
              <Traces
                tracks={toUnitBoxMulti(yonders.map((y) => y.track))}
                height={170}
              />
            </div>
            <ul className="flex flex-col divide-y divide-[var(--border)]">
              {yonders.map((y) => (
                <li key={y.id}>
                  <Link
                    href={`/recap/${y.id}`}
                    className="flex items-center justify-between py-2.5 hover:text-[var(--accent)]"
                  >
                    <span className="text-sm">
                      {new Date(y.endedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <span className="text-xs font-mono text-[var(--muted)] tabular-nums">
                      {fmtDist(y.walked)} · {y.yondered.toFixed(1)}×
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <ul className="flex flex-col">
          {(isOwner ? remaining : map.items).map((it) => (
            <li
              key={it.id}
              className="flex items-center gap-3 py-3 border-b border-[var(--border)]"
            >
              {isOwner && (
                <button
                  type="button"
                  onClick={() => markVisited(it.id, true)}
                  aria-label="Mark visited"
                  className="size-5 rounded-full border border-[var(--muted)] hover:border-[var(--accent)] shrink-0"
                />
              )}
              <PlacePhoto
                lat={it.lat}
                lon={it.lon}
                name={it.name}
                className="size-12 rounded-lg shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="font-display text-lg truncate">{it.name}</div>
                {it.label && (
                  <div className="text-xs text-[var(--muted)] truncate">
                    {it.label}
                  </div>
                )}
              </div>
            </li>
          ))}
          {isOwner && remaining.length === 0 && (
            <li className="text-sm text-[var(--muted)] py-3">
              All seen, visit one again?
            </li>
          )}
        </ul>

        {isOwner && seen.length > 0 && (
          <section className="flex flex-col">
            <button
              type="button"
              onClick={() => setSeenOpen((v) => !v)}
              className="flex items-center justify-between py-2 text-[10px] uppercase tracking-widest text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <span>Seen ({seen.length})</span>
              <span>{seenOpen ? "−" : "+"}</span>
            </button>
            {seenOpen && (
              <ul className="flex flex-col">
                {seen.map((it) => (
                  <li
                    key={it.id}
                    className="flex items-center gap-3 py-3 border-b border-[var(--border)] opacity-80"
                  >
                    <button
                      type="button"
                      onClick={() => markVisited(it.id, false)}
                      aria-label="Visit again"
                      title="Visit again"
                      className="size-5 rounded-full bg-[var(--accent)] text-black flex items-center justify-center text-[10px] shrink-0"
                    >
                      <RotateCcw className="w-3 h-3" strokeWidth={2} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-base truncate">
                        {it.name}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <div className="mt-auto flex flex-col gap-2">
          <button
            type="button"
            onClick={() => startYonder(!isOwner || allDone)}
            disabled={map.items.length === 0}
            className="rounded-full bg-[var(--accent)] text-black font-semibold py-3 active:opacity-80 disabled:opacity-30"
          >
            {!isOwner
              ? "Yonder this map"
              : allDone
                ? "Yonder again"
                : remaining.length < map.items.length
                  ? "Continue this map"
                  : "Yonder this map"}
          </button>
          {isOwner && (
            <>
              <div className="flex items-center gap-2">
                <Link
                  href={`/maps/${map.id}/edit`}
                  className="flex-1 rounded-full border border-[var(--border)] text-[var(--foreground)] py-2.5 flex items-center justify-center gap-2 hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  <Pencil className="w-4 h-4" strokeWidth={1.75} />
                  Edit
                </Link>
                <div className="flex-1">
                  <MapShareControl
                    map={map}
                    onChange={(v) => setMap({ ...map, visibility: v })}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => void onDelete()}
                className="self-center text-xs text-[var(--muted)] hover:text-red-400 inline-flex items-center gap-1.5 pt-1"
              >
                <Trash2 className="w-3 h-3" strokeWidth={1.75} />
                Delete map
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
