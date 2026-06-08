"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { acceptFollowRequest, listFollowRequests, rejectFollowRequest } from "@/lib/data";
import type { Profile } from "@/lib/types";

/** Pending follow requests for a private account, with accept / decline. Renders
 * nothing when there are none. */
export default function FollowRequests() {
  const [reqs, setReqs] = useState<Profile[]>([]);

  useEffect(() => {
    let c = false;
    void listFollowRequests().then((r) => {
      if (!c) setReqs(r);
    });
    return () => {
      c = true;
    };
  }, []);

  if (reqs.length === 0) return null;

  const act = async (p: Profile, accept: boolean) => {
    setReqs((rs) => rs.filter((x) => x.id !== p.id));
    if (accept) await acceptFollowRequest(p.id);
    else await rejectFollowRequest(p.id);
  };

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
        Follow requests ({reqs.length})
      </h2>
      <ul className="flex flex-col">
        {reqs.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2">
            <Link href={`/u/${p.username}`} className="flex items-center gap-3 flex-1 min-w-0 hover:text-[var(--accent)]">
              <div className="size-9 shrink-0 rounded-full bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center font-display text-xs text-[var(--warm)]">
                {(p.displayName ?? p.username).replace(/[@.]/g, "").slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="font-display text-sm truncate">{p.displayName ?? `@${p.username}`}</div>
                <div className="text-[11px] text-[var(--muted)]">@{p.username}</div>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => void act(p, true)}
              className="rounded-full bg-[var(--accent)] text-black text-xs font-semibold px-3 py-1.5 active:opacity-80"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => void act(p, false)}
              className="text-xs text-[var(--muted)] hover:text-red-400 px-1"
            >
              Decline
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
