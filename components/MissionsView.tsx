"use client";
import { Ruler } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState, PageHeader, PageScaffold } from "@/components/ui";
import { loadMissions, type Mission } from "@/lib/data";
import { fmtDist } from "@/lib/geo";

export default function MissionsView() {
  const [missions, setMissions] = useState<Mission[] | null>(null);

  useEffect(() => {
    let c = false;
    void loadMissions().then((m) => !c && setMissions(m));
    return () => {
      c = true;
    };
  }, []);

  return (
    <PageScaffold>
      <PageHeader
        kicker="Straight-line missions"
        title="Hold the line"
        backHref="/"
      />
      <p className="text-sm text-[var(--muted)] -mt-2">
        Walk a fixed line A→B as straight as you can. Closest to the line wins —
        never the fastest.
      </p>

      {missions === null ? null : missions.length === 0 ? (
        <EmptyState
          icon={Ruler}
          title="No missions yet"
          body="Finish a straight-line yonder, then turn it into a mission for others to take on."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {missions.map((m) => (
            <li key={m.id}>
              <Link
                href={`/missions/${m.id}`}
                className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 hover:border-[var(--accent)]/50"
              >
                <Ruler className="w-5 h-5 text-[var(--accent)] shrink-0" strokeWidth={1.75} />
                <div className="min-w-0 flex-1">
                  <div className="font-display text-lg truncate">
                    {m.name ?? "Straight-line mission"}
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    {m.who} · {fmtDist(m.distanceM)} · {m.attempts ?? 0}{" "}
                    {m.attempts === 1 ? "attempt" : "attempts"}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageScaffold>
  );
}
