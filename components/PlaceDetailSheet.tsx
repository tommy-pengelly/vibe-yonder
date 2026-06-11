"use client";
import { Heart, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Drawer } from "vaul";
import PlacePhoto from "@/components/PlacePhoto";
import {
  getFavourite,
  pushFavourite,
  removeFavourite,
} from "@/lib/data";
import { fmtDist } from "@/lib/geo";
import { categoryByKey } from "@/lib/nearby";

export type PlaceLite = {
  name: string;
  lat: number;
  lon: number;
  label?: string;
  category?: string;
  dist?: number;
  /** Has a Wikipedia/wikidata entry, shows a subtle "noted" mark. */
  wiki?: string;
};

export type PlaceAction = {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  primary?: boolean;
};

// One sheet for "tell me more about this place", reused wherever a place shows
// up, search, category results, sidequests. Opens partway and drags to full;
// shows a Wikimedia photo, what kind of place it is, and context actions. A
// built-in Favourite toggle (universal) sits alongside the caller's actions.
export default function PlaceDetailSheet({
  open,
  onClose,
  place,
  actions = [],
}: {
  open: boolean;
  onClose: () => void;
  place: PlaceLite | null;
  actions?: PlaceAction[];
}) {
  const snapPoints = ["440px", 1];
  const [snap, setSnap] = useState<number | string | null>(snapPoints[0]);
  const [favId, setFavId] = useState<string | null>(null);
  const [blurb, setBlurb] = useState<string | null>(null);

  useEffect(() => {
    if (open) setSnap(snapPoints[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !place) return;
    let c = false;
    void getFavourite(place.lat, place.lon, place.name).then((f) => {
      if (!c) setFavId(f?.id ?? null);
    });
    return () => {
      c = true;
    };
  }, [open, place]);

  // A short Wikipedia blurb, when there is one. Curiosity, never navigation.
  useEffect(() => {
    if (!open || !place) {
      setBlurb(null);
      return;
    }
    let c = false;
    const ctrl = new AbortController();
    void fetch(
      `/api/place-blurb?lat=${place.lat}&lon=${place.lon}&name=${encodeURIComponent(place.name)}`,
      { signal: ctrl.signal },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { extract?: string } | null) => {
        if (!c) setBlurb(d?.extract ?? null);
      })
      .catch(() => {});
    return () => {
      c = true;
      ctrl.abort();
    };
  }, [open, place]);

  const toggleFav = async () => {
    if (!place) return;
    if (favId) {
      const id = favId;
      setFavId(null);
      await removeFavourite(id);
    } else {
      const f = await pushFavourite({
        name: place.name,
        label: place.label,
        lat: place.lat,
        lon: place.lon,
      });
      setFavId(f.id);
    }
  };

  const cat = place?.category ? categoryByKey(place.category) : undefined;

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(o) => !o && onClose()}
      snapPoints={snapPoints}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 h-full max-h-[97%] flex flex-col rounded-t-2xl border-t border-[var(--border)] bg-[var(--surface)] outline-none">
          <div className="mx-auto mt-3 h-1 w-9 shrink-0 rounded-full bg-[var(--border)]" />
          <div className="flex-1 overflow-y-auto">
            {place && (
              <>
                <PlacePhoto
                  lat={place.lat}
                  lon={place.lon}
                  name={place.name}
                  keepPlaceholder
                  className="w-full h-48"
                />
                <div className="px-5 py-4 flex flex-col gap-4 max-w-md mx-auto">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {cat && (
                        <span className="text-xs text-[var(--muted)]">
                          {cat.emoji} {cat.label}
                        </span>
                      )}
                      {place.dist != null && (
                        <span className="text-[11px] font-mono text-[var(--accent)] tabular-nums">
                          {fmtDist(place.dist)} away
                        </span>
                      )}
                      {place.wiki && (
                        <span className="text-[11px] text-[var(--accent)]">
                          ✦ Noted
                        </span>
                      )}
                    </div>
                    <Drawer.Title className="font-display text-2xl tracking-tight">
                      {place.name}
                    </Drawer.Title>
                    {place.label && (
                      <Drawer.Description className="text-sm text-[var(--muted)]">
                        {place.label}
                      </Drawer.Description>
                    )}
                  </div>

                  {blurb && (
                    <p className="text-sm leading-relaxed text-pretty text-[var(--warm)]">
                      {blurb}
                    </p>
                  )}

                  <div className="flex flex-col gap-2">
                    {actions.map((a) => (
                      <button
                        key={a.label}
                        type="button"
                        onClick={a.onClick}
                        className={`rounded-full py-3 font-semibold flex items-center justify-center gap-2 active:opacity-80 ${
                          a.primary
                            ? "bg-[var(--accent)] text-black"
                            : "border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                        }`}
                      >
                        <a.icon className="w-4 h-4" strokeWidth={1.75} />
                        {a.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => void toggleFav()}
                      className={`rounded-full py-3 border flex items-center justify-center gap-2 active:opacity-80 ${
                        favId
                          ? "border-[var(--accent)] text-[var(--accent)]"
                          : "border-[var(--border)] text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                      }`}
                    >
                      <Heart
                        className="w-4 h-4"
                        strokeWidth={1.75}
                        fill={favId ? "var(--accent)" : "none"}
                      />
                      {favId ? "Saved" : "Save place"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
