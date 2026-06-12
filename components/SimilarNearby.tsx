"use client";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import PlacePhoto from "@/components/PlacePhoto";
import { DISCOVERY_ENABLED } from "@/lib/flags";
import { haversine } from "@/lib/geo";
import type { NearbyPlace } from "@/lib/nearby";

// "More like these" for a map: the same federated discovery engine, but seeded
// by a map's items instead of your live position. Searches the map's area for
// notable curios (Wikidata-ranked), drops anything already on the map, and lets
// you add one. On-brand: it helps you *curate a richer wander*, never a
// directory. Behind DISCOVERY_ENABLED with the rest of the discovery surface.

type Seed = { lat: number; lon: number };
type AddPlace = { name: string; label: string; lat: number; lon: number; wiki?: string };

const EXCLUDE_M = 60; // a suggestion this close to an existing item is "the same"

export default function SimilarNearby({
  items,
  fallback,
  existingNames,
  onAdd,
}: {
  items: Seed[];
  /** Used when the map has no items yet (the user's position). */
  fallback: Seed | null;
  /** Names already on the map, to suppress duplicates by label too. */
  existingNames: Set<string>;
  onAdd: (p: AddPlace) => void;
}) {
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [added, setAdded] = useState<Set<string>>(new Set());

  // Seed = centroid of the map's items (or the fallback). Round it so small
  // edits don't refetch; key the effect on the rounded cell.
  const origin = centroid(items) ?? fallback;
  const cell = origin ? `${origin.lat.toFixed(2)},${origin.lon.toFixed(2)}` : "";

  useEffect(() => {
    if (!DISCOVERY_ENABLED || !origin) return;
    let c = false;
    const ctrl = new AbortController();
    void fetch(`/api/nearby?scope=ambient&lat=${origin.lat}&lon=${origin.lon}`, {
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: NearbyPlace[]) => {
        if (c) return;
        const notable = data
          .filter((p) => p.wiki) // the notable layer only, for "similar"
          .filter((p) => !existingNames.has(p.name.toLowerCase()))
          .filter((p) => !items.some((it) => haversine(it.lat, it.lon, p.lat, p.lon) < EXCLUDE_M))
          .sort((a, b) => (b.sitelinks ?? 0) - (a.sitelinks ?? 0))
          .slice(0, 8);
        setPlaces(notable);
      })
      .catch(() => {});
    return () => {
      c = true;
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cell]);

  if (!DISCOVERY_ENABLED) return null;
  const visible = places.filter((p) => !added.has(p.id ?? p.name));
  if (visible.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
        More like these
      </span>
      <div className="flex gap-3 overflow-x-auto -mx-5 px-5 pb-1 [scrollbar-width:none]">
        {visible.map((p) => {
          const key = p.id ?? p.name;
          return (
            <div
              key={key}
              className="shrink-0 w-40 rounded-2xl border border-[var(--border)] overflow-hidden flex flex-col"
            >
              <PlacePhoto
                lat={p.lat}
                lon={p.lon}
                name={p.name}
                wiki={p.wiki}
                keepPlaceholder
                className="w-full h-20"
              />
              <div className="p-2.5 flex flex-col gap-2 flex-1">
                <div className="min-w-0">
                  <div className="font-display text-sm leading-tight line-clamp-2">{p.name}</div>
                  {p.typeLabel && (
                    <div className="text-[11px] text-[var(--muted)] capitalize truncate">
                      {p.typeLabel}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onAdd({ name: p.name, label: p.typeLabel ?? "", lat: p.lat, lon: p.lon, wiki: p.wiki });
                    setAdded((s) => new Set(s).add(key));
                  }}
                  className="mt-auto inline-flex items-center justify-center gap-1 rounded-full border border-[var(--border)] py-1.5 text-xs hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
                  Add
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function centroid(items: Seed[]): Seed | null {
  if (items.length === 0) return null;
  const lat = items.reduce((s, i) => s + i.lat, 0) / items.length;
  const lon = items.reduce((s, i) => s + i.lon, 0) / items.length;
  return { lat, lon };
}
