"use client";
import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthUser } from "@/lib/auth";
import { loadMaps } from "@/lib/data";
import type { StoredMap } from "@/lib/types";

export default function MapsView() {
  const [maps, setMaps] = useState<StoredMap[]>([]);
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
    <>
      <div className="flex-1 flex flex-col w-full max-w-md mx-auto px-5 pt-8 pb-10 gap-6">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/you"
              aria-label="Back"
              className="size-9 -ml-2 rounded-full flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
            </Link>
            <div>
              <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
                Maps
              </span>
              <h1 className="font-display text-3xl tracking-tight leading-none">
                Reusable yonders
              </h1>
            </div>
          </div>
          <Link
            href="/maps/new"
            aria-label="New map"
            className="size-9 rounded-full bg-[var(--accent)] text-black flex items-center justify-center active:opacity-80"
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
          </Link>
        </header>

        {maps.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No maps yet. Build one to wander a chain of places, at your own
            pace, across as many days as you like.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--border)]">
            {maps.map((m) => {
              const remaining = m.items.filter((i) => !i.visited).length;
              const total = m.items.length;
              return (
                <li key={m.id}>
                  <Link
                    href={`/maps/${m.id}`}
                    className="w-full text-left py-3 flex items-center justify-between hover:text-[var(--accent)]"
                  >
                    <div className="min-w-0">
                      <div className="font-display text-lg truncate">
                        {m.name}
                      </div>
                      <div className="text-xs text-[var(--muted)] mt-0.5">
                        {m.mode === "ordered" ? "Step through" : "Wander between"}
                        {" · "}
                        {total === 0
                          ? "no places"
                          : remaining === 0
                            ? "all seen"
                            : remaining === total
                              ? `${total} place${total === 1 ? "" : "s"}`
                              : `${remaining} of ${total} left`}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
