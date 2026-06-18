"use client";
import { useEffect, useState } from "react";
import { ListRow, PageHeader, PageScaffold } from "@/components/ui";
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
    <PageScaffold>
      <PageHeader
        kicker={`@${username}`}
        title={mode === "followers" ? "Followers" : "Following"}
        backHref={`/u/${username}`}
      />

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
              <ListRow
                href={`/u/${p.username}`}
                leading={
                  <div className="size-10 rounded-full bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center font-display text-sm text-[var(--warm)]">
                    {(p.displayName ?? p.username).replace(/[@.]/g, "").slice(0, 2).toUpperCase()}
                  </div>
                }
                title={p.displayName ?? `@${p.username}`}
                subtitle={`@${p.username}`}
              />
            </li>
          ))}
        </ul>
      )}
    </PageScaffold>
  );
}
