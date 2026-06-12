"use client";
import { useEffect, useState } from "react";
import type { PlacePhotoData } from "@/lib/types";

type Props = {
  lat: number;
  lon: number;
  name: string;
  /** The place's own Wikipedia title / Wikidata id (OSM `wikipedia`/`wikidata`
   * tag), when known. Resolves an exact-entity photo instead of guessing. */
  wiki?: string;
  /** Sizing/shape comes from the parent; the image fills it. */
  className?: string;
  /** Render a faint placeholder when no photo is found, instead of nothing. */
  keepPlaceholder?: boolean;
};

// A photo of a place, resolved lazily from Wikimedia. Coverage is uneven by
// design, when there's nothing, it renders empty (or a faint placeholder).
// Attribution is shown small over the image, as the CC licences require.
export default function PlacePhoto({
  lat,
  lon,
  name,
  wiki,
  className = "",
  keepPlaceholder = false,
}: Props) {
  // undefined = loading, null = none found, object = a photo.
  const [photo, setPhoto] = useState<PlacePhotoData | null | undefined>(
    undefined,
  );

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    const url =
      `/api/place-photo?lat=${lat}&lon=${lon}` +
      `&name=${encodeURIComponent(name)}` +
      (wiki ? `&wiki=${encodeURIComponent(wiki)}` : "");
    fetch(url, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: PlacePhotoData | null) => {
        if (alive) setPhoto(d);
      })
      .catch(() => {
        if (alive) setPhoto(null);
      });
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [lat, lon, name, wiki]);

  if (photo === null && !keepPlaceholder) return null;

  return (
    <div
      className={`relative overflow-hidden bg-white/[0.04] ${className}`}
      aria-hidden={!photo}
    >
      {photo && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt={photo.title}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <a
            href={photo.source}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title={
              [photo.author, photo.license].filter(Boolean).join(" · ") ||
              "Source"
            }
            className="absolute bottom-0 right-0 px-1.5 py-0.5 text-[8px] uppercase tracking-wide text-white/70 bg-black/45 hover:text-white"
          >
            {photo.license ?? "Wikimedia"}
          </a>
        </>
      )}
    </div>
  );
}
