"use client";
import { ArrowLeft, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import BottomNav from "@/components/BottomNav";
import { useAuthUser } from "@/lib/auth";
import { deleteList, getList, saveList } from "@/lib/data";
import type { StoredList, Target } from "@/lib/types";

export default function ListDetail({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useAuthUser();
  const [list, setList] = useState<StoredList | null>(null);
  const [seenOpen, setSeenOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getList(id).then((l) => {
      if (!cancelled) setList(l);
    });
    return () => {
      cancelled = true;
    };
  }, [id, user]);

  if (!list) {
    return (
      <div className="flex-1 flex items-center justify-center px-5">
        <p className="text-sm text-[var(--muted)]">List not found.</p>
      </div>
    );
  }

  const remaining = list.items.filter((i) => !i.visited);
  const seen = list.items.filter((i) => i.visited);
  const allDone = list.items.length > 0 && remaining.length === 0;

  const markVisited = (itemId: string, visited: boolean) => {
    const next: StoredList = {
      ...list,
      items: list.items.map((it) =>
        it.id === itemId
          ? { ...it, visited, visitedAt: visited ? Date.now() : undefined }
          : it,
      ),
    };
    setList(next);
    void saveList(next);
  };

  const startYonder = () => {
    if (typeof window === "undefined") return;
    // Resume: only the still-unvisited items become active targets.
    const active = list.items.filter((i) => !i.visited);
    const targets: Target[] = active.map((i) => ({
      id: crypto.randomUUID(),
      name: i.name,
      label: i.label,
      lat: i.lat,
      lon: i.lon,
      visited: false,
    }));
    const listItemIdByTargetId: Record<string, string> = {};
    targets.forEach((t, k) => {
      listItemIdByTargetId[t.id] = active[k].id;
    });
    window.sessionStorage.setItem(
      "vibe-yonder.start",
      JSON.stringify({
        mode: targets.length === 1 ? "single" : list.mode,
        targets,
        listId: list.id,
        listItemIdByTargetId,
        name: list.name,
      }),
    );
    router.push("/");
  };

  const onDelete = async () => {
    await deleteList(list.id);
    router.push("/lists");
  };

  return (
    <>
      <div className="flex-1 flex flex-col w-full max-w-md mx-auto px-5 pt-8 pb-10 gap-6">
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/lists"
              aria-label="Back"
              className="size-9 -ml-2 rounded-full flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] shrink-0"
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
            </Link>
            <div className="min-w-0">
              <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
                {list.mode === "ordered" ? "Step through" : "Wander between"}
              </span>
              <h1 className="font-display text-3xl tracking-tight leading-none truncate">
                {list.name}
              </h1>
              <p className="text-sm text-[var(--warm)] mt-1">
                {remaining.length} of {list.items.length} left
              </p>
            </div>
          </div>
        </header>

        <ul className="flex flex-col">
          {remaining.map((it) => (
            <li
              key={it.id}
              className="flex items-center gap-3 py-3 border-b border-[var(--border)]"
            >
              <button
                type="button"
                onClick={() => markVisited(it.id, true)}
                aria-label="Mark visited"
                className="size-5 rounded-full border border-[var(--muted)] hover:border-[var(--accent)] shrink-0"
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
          {remaining.length === 0 && (
            <li className="text-sm text-[var(--muted)] py-3">
              All seen — visit one again?
            </li>
          )}
        </ul>

        {seen.length > 0 && (
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
            onClick={startYonder}
            disabled={allDone}
            className="rounded-full bg-[var(--accent)] text-black font-semibold py-3 active:opacity-80 disabled:opacity-30"
          >
            {allDone ? "All seen" : "Yonder this list"}
          </button>
          <button
            type="button"
            onClick={() => void onDelete()}
            className="self-center text-xs text-[var(--muted)] hover:text-red-400 inline-flex items-center gap-1.5 pt-1"
          >
            <Trash2 className="w-3 h-3" strokeWidth={1.75} />
            Delete list
          </button>
        </div>
      </div>
      <BottomNav />
    </>
  );
}
