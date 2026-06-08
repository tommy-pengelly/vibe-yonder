"use client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import BottomNav from "@/components/BottomNav";
import { getProfileByUsername, listFollowers, listFollowing } from "@/lib/data";
import type { Profile } from "@/lib/types";

export default function FollowList({
  username,
  mode,
}: {
  username: string;
  mode: "followers" | "following";
}) {
  const [people, setPeople] = useState<Profile[] | null>(null);

  useEffect(() => {
    let c = false;
    void getProfileByUsername(username).then(async (p) => {
      if (!p) {
        if (!c) setPeople([]);
        return;
      }
      const list = mode === "followers" ? await listFollowers(p.id) : await listFollowing(p.id);
      if (!c) setPeople(list);
    });
    return () => {
      c = true;
    };
  }, [username, mode]);

  return (
    <>
      <div className="flex-1 flex flex-col w-full max-w-md mx-auto px-5 pt-8 pb-10 gap-5">
        <header className="flex items-center gap-3">
          <Link
            href={`/u/${username}`}
            aria-label="Back"
            className="size-9 -ml-2 rounded-full flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
          </Link>
          <div>
            <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">@{username}</span>
            <h1 className="font-display text-2xl tracking-tight leading-none capitalize">{mode}</h1>
          </div>
        </header>

        {people === null ? (
          <p className="text-sm text-[var(--muted)] py-10 text-center">Loading…</p>
        ) : people.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            {mode === "followers" ? "No followers yet." : "Not following anyone yet."}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--border)]">
            {people.map((p) => (
              <li key={p.id}>
                <Link href={`/u/${p.username}`} className="flex items-center gap-3 py-3 hover:text-[var(--accent)]">
                  <div className="size-10 shrink-0 rounded-full bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center font-display text-sm text-[var(--warm)]">
                    {(p.displayName ?? p.username).replace(/[@.]/g, "").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-display text-base truncate">{p.displayName ?? `@${p.username}`}</div>
                    <div className="text-xs text-[var(--muted)]">@{p.username}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <BottomNav />
    </>
  );
}
