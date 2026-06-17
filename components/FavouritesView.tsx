"use client";
import { Footprints, Heart, MapPin, Pencil, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useGeolocation } from "@/hooks/useGeolocation";
import { primeOrientation } from "@/hooks/useHeading";
import { usePlaceSearch } from "@/hooks/usePlaceSearch";
import PlacePhoto from "@/components/PlacePhoto";
import { BottomSheet, EmptyState, PageHeader, PageScaffold } from "@/components/ui";
import { useAuthUser } from "@/lib/auth";
import { fmtDist } from "@/lib/geo";
import {
  loadFavourites,
  pushFavourite,
  removeFavourite,
  setFavouriteAlias,
} from "@/lib/data";
import type { FavouritePlace, Fix, RankedResult } from "@/lib/types";

export default function FavouritesView({
  embedded = false,
  query = "",
  addOpen: addOpenProp,
  onAddOpenChange,
}: {
  embedded?: boolean;
  query?: string;
  /** Controlled add-sheet open state (the Me > Places tab drives it). */
  addOpen?: boolean;
  onAddOpenChange?: (v: boolean) => void;
} = {}) {
  const [favourites, setFavourites] = useState<FavouritePlace[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [addOpenLocal, setAddOpenLocal] = useState(false);
  // Controlled when the parent passes addOpen (then it owns the "+" button too).
  const controlledAdd = addOpenProp !== undefined;
  const addOpen = addOpenProp ?? addOpenLocal;
  const setAddOpen = onAddOpenChange ?? setAddOpenLocal;
  const router = useRouter();
  const { user } = useAuthUser();
  const { fix } = useGeolocation(true);

  useEffect(() => {
    let cancelled = false;
    void loadFavourites().then((f) => {
      if (!cancelled) setFavourites(f);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const startYonder = (f: FavouritePlace) => {
    if (typeof window === "undefined") return;
    void primeOrientation(); // grab the compass on this tap so the scope spins
    window.sessionStorage.setItem(
      "vibe-yonder.start",
      JSON.stringify({
        mode: "single",
        targets: [
          {
            id: crypto.randomUUID(),
            name: f.name,
            label: f.label,
            lat: f.lat,
            lon: f.lon,
            visited: false,
          },
        ],
      }),
    );
    router.push("/walk");
  };

  const remove = async (id: string) => {
    await removeFavourite(id);
    setFavourites(await loadFavourites());
  };

  const beginEdit = (f: FavouritePlace) => {
    setEditing(f.id);
    setDraft(f.alias ?? "");
  };

  const commitEdit = async (f: FavouritePlace) => {
    const next = draft.trim();
    setEditing(null);
    if (next === (f.alias ?? "")) return;
    // Optimistic.
    setFavourites((prev) =>
      (prev ?? []).map((x) =>
        x.id === f.id ? { ...x, alias: next || undefined } : x,
      ),
    );
    await setFavouriteAlias(f.id, next);
  };

  const addFavourite = async (r: RankedResult) => {
    setAddOpen(false);
    const created = await pushFavourite({
      name: r.name,
      label: r.label,
      lat: r.lat,
      lon: r.lon,
    });
    setFavourites((prev) => {
      const list = prev ?? [];
      return list.some((f) => f.id === created.id) ? list : [created, ...list];
    });
  };

  const q = query.trim().toLowerCase();
  const shown = (favourites ?? []).filter(
    (f) => !q || (f.alias ?? "").toLowerCase().includes(q) || f.name.toLowerCase().includes(q),
  );

  const grid =
    favourites === null ? null : favourites.length === 0 ? (
        // Embedded (the Me > Places tab), the visited list sits below, so keep
        // the empty prompt light rather than a full-page EmptyState.
        embedded ? (
          <p className="text-sm text-[var(--muted)]">
            No saved places yet. Heart a place to keep it here.
          </p>
        ) : (
          <EmptyState
            icon={Heart}
            title="No places yet"
            body="Heart a place on a yonder to keep it here, then nickname it, Home, Work, the best café, for one-tap wandering."
          />
        )
      ) : shown.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No saved places match.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {shown.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5"
            >
              <PlacePhoto
                lat={f.lat}
                lon={f.lon}
                name={f.name}
                keepPlaceholder
                className="size-12 rounded-xl shrink-0"
              />
              {editing === f.id ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => void commitEdit(f)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void commitEdit(f);
                    if (e.key === "Escape") setEditing(null);
                  }}
                  placeholder="Nickname, Home, Work, café…"
                  className="flex-1 min-w-0 bg-transparent border-b border-[var(--accent)] px-1 py-1.5 text-base outline-none placeholder:text-[var(--muted)]/60"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => startYonder(f)}
                  className="flex-1 text-left min-w-0 hover:text-[var(--accent)]"
                >
                  <div className="font-display text-lg truncate">
                    {f.alias || f.name}
                  </div>
                  <div className="text-xs text-[var(--muted)] truncate">
                    {f.alias ? f.name : (f.label ?? "")}
                  </div>
                </button>
              )}
              {editing !== f.id && (
                <>
                  <Link
                    href={`/ways?near=${f.lat},${f.lon}&name=${encodeURIComponent(f.alias || f.name)}`}
                    className="size-8 flex items-center justify-center text-[var(--muted)] hover:text-[var(--accent)]"
                    aria-label={`Ways to ${f.alias || f.name}`}
                    title="See all the ways you've wandered here"
                  >
                    <Footprints className="w-4 h-4" strokeWidth={1.75} />
                  </Link>
                  <button
                    type="button"
                    onClick={() => beginEdit(f)}
                    className="size-8 flex items-center justify-center text-[var(--muted)] hover:text-[var(--accent)]"
                    aria-label="Rename"
                  >
                    <Pencil className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => void remove(f.id)}
                className="size-8 flex items-center justify-center text-[var(--muted)] hover:text-red-400"
                aria-label="Remove"
              >
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
          ))}
        </div>
      );

  const addSheet = (
    <AddFavouriteSheet
      open={addOpen}
      onClose={() => setAddOpen(false)}
      onAdd={addFavourite}
      position={fix}
    />
  );

  if (embedded) {
    return (
      <div className="flex flex-col gap-3">
        {!controlledAdd && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-1.5 text-sm text-[var(--accent)] hover:opacity-80"
            >
              <Plus className="w-4 h-4" strokeWidth={1.75} /> Add a place
            </button>
          </div>
        )}
        {grid}
        {addSheet}
      </div>
    );
  }

  return (
    <PageScaffold>
      <PageHeader
        kicker="Places"
        title="Places you love"
        backHref="/you"
        action={
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            aria-label="Add a place"
            className="size-9 rounded-full bg-[var(--accent)] text-black flex items-center justify-center active:opacity-80"
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
          </button>
        }
      />
      {grid}
      {addSheet}
    </PageScaffold>
  );
}

function AddFavouriteSheet({
  open,
  onClose,
  onAdd,
  position,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (r: RankedResult) => void;
  position: Fix | null;
}) {
  // With your location, results are local-first and show how far away each is,
  // so it's quick to pick the right spot (this was the "hard to add" pain).
  const { q, setQ, results, loading } = usePlaceSearch(position);
  return (
    <BottomSheet open={open} onClose={onClose} title="Add a place" minHeightVh={60}>
      <div className="relative">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]"
          strokeWidth={1.75}
        />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a place you love…"
          className="w-full rounded-full bg-[var(--surface-2)] border border-[var(--border)] pl-11 pr-4 py-3 text-base outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]/60"
          inputMode="search"
        />
      </div>
      <ul className="flex flex-col divide-y divide-[var(--border)] min-h-12">
        {loading && (
          <li className="text-sm text-[var(--muted)] py-2 px-1">Searching…</li>
        )}
        {!loading && q.trim().length >= 3 && results.length === 0 && (
          <li className="text-sm text-[var(--muted)] py-2 px-1">
            No matches. Try adding the town.
          </li>
        )}
        {results.map((r, i) => (
          <li key={`${r.lat},${r.lon},${i}`} className="flex items-center gap-3">
            <span className="shrink-0 size-9 rounded-full border border-[var(--border)] flex items-center justify-center text-[var(--muted)]">
              <MapPin className="w-4 h-4" strokeWidth={1.75} />
            </span>
            <button
              type="button"
              onClick={() => onAdd(r)}
              className="flex-1 text-left py-3 min-w-0 hover:text-[var(--accent)]"
            >
              {r.dist != null && (
                <div className="text-[11px] font-mono text-[var(--accent)] tabular-nums">
                  {fmtDist(r.dist)} away
                </div>
              )}
              <div className="font-display text-base truncate">{r.name}</div>
              <div className="text-xs text-[var(--muted)] line-clamp-1">
                {r.label}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}
