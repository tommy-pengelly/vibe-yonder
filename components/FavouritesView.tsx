"use client";
import { ArrowLeft, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import BottomNav from "@/components/BottomNav";
import { useAuthUser } from "@/lib/auth";
import { loadFavourites, removeFavourite } from "@/lib/data";
import type { FavouritePlace } from "@/lib/types";

export default function FavouritesView() {
  const [favourites, setFavourites] = useState<FavouritePlace[]>([]);
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
    router.push("/");
  };

  const remove = async (id: string) => {
    await removeFavourite(id);
    setFavourites(await loadFavourites());
  };

  return (
    <>
      <div className="flex-1 flex flex-col w-full max-w-md mx-auto px-5 pt-8 pb-10 gap-6">
        <header className="flex items-center gap-3">
          <Link
            href="/you"
            aria-label="Back"
            className="size-9 -ml-2 rounded-full flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
          </Link>
          <div>
            <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
              Favourites
            </span>
            <h1 className="font-display text-3xl tracking-tight leading-none">
              Places you love
            </h1>
          </div>
        </header>

        {favourites.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No favourites yet. Heart a place from a yonder to keep it here.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--border)]">
            {favourites.map((f) => (
              <li
                key={f.id}
                className="flex items-center gap-2 py-3"
              >
                <button
                  type="button"
                  onClick={() => startYonder(f)}
                  className="flex-1 text-left min-w-0 hover:text-[var(--accent)]"
                >
                  <div className="font-display text-lg truncate">{f.name}</div>
                  {f.label && (
                    <div className="text-xs text-[var(--muted)] truncate">
                      {f.label}
                    </div>
                  )}
                </button>
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
      </div>
      <BottomNav />
    </>
  );
}
