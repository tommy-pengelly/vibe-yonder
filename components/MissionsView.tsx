"use client";
import { Plus, Ruler } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EmptyState, PageHeader, PageScaffold } from "@/components/ui";
import { loadMissions, type Mission } from "@/lib/data";
import { fmtDist } from "@/lib/geo";

export default function MissionsView() {
  const router = useRouter();
  const [missions, setMissions] = useState<Mission[] | null>(null);

  useEffect(() => {
    let c = false;
    void loadMissions().then((m) => !c && setMissions(m));
    return () => {
      c = true;
    };
  }, []);

  // "New mission" = set up a fresh straight line. Reuse the launcher's line mode
  // (the create flow lives there) via the createMode hint, so creating and
  // browsing share one pathway.
  const newMission = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("vibe-yonder.createMode", "line");
    }
    router.push("/");
  };

  return (
    <PageScaffold>
      <PageHeader
        kicker="Straight-line missions"
        title="Hold the line"
        backHref="/"
        action={
          <button
            type="button"
            onClick={newMission}
            aria-label="New mission"
            className="size-9 rounded-full bg-[var(--accent)] text-black flex items-center justify-center active:opacity-80"
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
          </button>
        }
      />
      <p className="text-sm text-[var(--muted)] -mt-2">
        Walk a fixed line from A to B as straight as you can. Closest to the
        line wins, never the fastest.
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
