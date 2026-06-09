"use client";
import { ArrowLeft, Bookmark, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthUser } from "@/lib/auth";
import { getYonder, loadSaved, removeSaved } from "@/lib/data";
import type { StoredSaved, Target } from "@/lib/types";

export default function SavedView() {
  const router = useRouter();
  const { user } = useAuthUser();
  const [saved, setSaved] = useState<StoredSaved[]>([]);

  useEffect(() => {
    let cancelled = false;
    void loadSaved().then((s) => {
      if (!cancelled) setSaved(s);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const start = async (s: StoredSaved) => {
    if (typeof window === "undefined") return;
    let targets: Target[];
    let mode = "single";
    let name: string | undefined;
    let mapId: string | undefined;

    if (s.kind === "place" && s.lat != null && s.lon != null) {
      targets = [
        {
          id: crypto.randomUUID(),
          name: s.name,
          lat: s.lat,
          lon: s.lon,
          visited: false,
        },
      ];
    } else {
      // A saved "list" bookmarks a multi-destination yonder by id; pull its
      // destinations back to re-wander them.
      const y = await getYonder(s.refId);
      if (!y) return;
      targets = y.destinations.map((d) => ({
        id: crypto.randomUUID(),
        name: d.name,
        label: d.label,
        lat: d.lat,
        lon: d.lon,
        visited: false,
      }));
      mode = y.mode;
      name = y.name;
      mapId = y.mapId;
    }

    window.sessionStorage.setItem(
      "vibe-yonder.start",
      JSON.stringify({ mode, targets, name, mapId }),
    );
    router.push("/walk");
  };

  const remove = async (id: string) => {
    await removeSaved(id);
    setSaved(await loadSaved());
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
              Saved for later
            </span>
            <h1 className="font-display text-3xl tracking-tight leading-none">
              To wander another day
            </h1>
          </div>
        </header>

        {saved.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            Nothing saved yet. Tap &ldquo;Save for later&rdquo; on a recap to keep
            a place or a set of places here.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--border)]">
            {saved.map((s) => (
              <li key={s.id} className="flex items-center gap-2 py-3">
                <button
                  type="button"
                  onClick={() => void start(s)}
                  className="flex-1 text-left min-w-0 flex items-center gap-3 hover:text-[var(--accent)]"
                >
                  <Bookmark
                    className="w-4 h-4 text-[var(--muted)] shrink-0"
                    strokeWidth={1.75}
                  />
                  <div className="min-w-0">
                    <div className="font-display text-lg truncate">{s.name}</div>
                    <div className="text-xs text-[var(--muted)]">
                      {s.kind === "place" ? "A place" : "Several places"}
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => void remove(s.id)}
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
    </>
  );
}
