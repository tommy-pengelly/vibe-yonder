"use client";
import { Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EmptyState, PageHeader, PageScaffold } from "@/components/ui";
import { useAuthUser } from "@/lib/auth";
import { loadFavourites, removeFavourite, setFavouriteAlias } from "@/lib/data";
import type { FavouritePlace } from "@/lib/types";
import { Heart } from "lucide-react";

export default function FavouritesView() {
  const [favourites, setFavourites] = useState<FavouritePlace[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const router = useRouter();
  const { user } = useAuthUser();

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

  return (
    <PageScaffold>
      <PageHeader
        kicker="Favourites"
        title="Places you love"
        backHref="/you"
      />

      {favourites === null ? null : favourites.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="No favourites yet"
          body="Heart a place on a yonder to keep it here, then nickname it — Home, Work, the best café — for one-tap wandering."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--border)]">
          {favourites.map((f) => (
            <li key={f.id} className="flex items-center gap-2 py-3">
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
                  placeholder="Nickname — Home, Work, café…"
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
                <button
                  type="button"
                  onClick={() => beginEdit(f)}
                  className="size-8 flex items-center justify-center text-[var(--muted)] hover:text-[var(--accent)]"
                  aria-label="Rename"
                >
                  <Pencil className="w-4 h-4" strokeWidth={1.75} />
                </button>
              )}
              <button
                type="button"
                onClick={() => void remove(f.id)}
                className="size-8 flex items-center justify-center text-[var(--muted)] hover:text-red-400"
                aria-label="Remove"
              >
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </PageScaffold>
  );
}
