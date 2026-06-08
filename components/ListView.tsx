"use client";
import { useState } from "react";
import type { StoredList } from "@/lib/types";

type Props = {
  list: StoredList;
  onStart: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMarkVisited: (itemId: string, visited: boolean) => void;
  onBack: () => void;
};

export default function ListView({
  list,
  onStart,
  onEdit,
  onDelete,
  onMarkVisited,
  onBack,
}: Props) {
  const remaining = list.items.filter((i) => !i.visited);
  const seen = list.items.filter((i) => i.visited);
  const [seenOpen, setSeenOpen] = useState(false);
  const allDone = list.items.length > 0 && remaining.length === 0;

  return (
    <div className="flex-1 flex flex-col w-full max-w-md mx-auto px-5 pt-8 pb-10 gap-6">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
            List
          </span>
          <h1 className="font-display text-3xl tracking-tight truncate">
            {list.name}
          </h1>
          <p className="text-sm text-[var(--warm)] mt-1">
            {remaining.length} of {list.items.length} left
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] mt-1"
        >
          Back
        </button>
      </header>

      <ul className="flex flex-col">
        {remaining.map((it) => (
          <li
            key={it.id}
            className="flex items-center gap-3 py-3 border-b border-[var(--border)]"
          >
            <button
              type="button"
              onClick={() => onMarkVisited(it.id, true)}
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
            You&apos;ve seen them all. Mark one for a return visit?
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
                  className="flex items-center gap-3 py-3 border-b border-[var(--border)] opacity-70"
                >
                  <button
                    type="button"
                    onClick={() => onMarkVisited(it.id, false)}
                    aria-label="Visit again"
                    title="Visit again"
                    className="size-5 rounded-full bg-[var(--accent)] text-black flex items-center justify-center text-[10px] shrink-0"
                  >
                    ✓
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
          onClick={onStart}
          disabled={allDone}
          className="rounded-full bg-[var(--accent)] text-black font-semibold py-3 active:opacity-80 disabled:opacity-30"
        >
          {allDone ? "All done" : "Yonder this list"}
        </button>
        <div className="flex items-center justify-between text-xs text-[var(--muted)]">
          <button
            type="button"
            onClick={onEdit}
            className="hover:text-[var(--foreground)]"
          >
            Edit list
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="hover:text-red-400"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
