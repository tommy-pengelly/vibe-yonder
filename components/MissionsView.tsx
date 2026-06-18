"use client";
import { Plus, Ruler } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BrowseCard, EmptyState, PageHeader, PageScaffold } from "@/components/ui";
import MissionLineViz from "@/components/MissionLineViz";
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
          body="Tap + to set up a straight line, or finish a straight-line yonder and turn it into a mission for others to take on."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {missions.map((m) => (
            <li key={m.id}>
              <BrowseCard
                href={`/missions/${m.id}`}
                title={m.name ?? "Straight-line mission"}
                meta={`${m.who} · ${fmtDist(m.distanceM)} · ${m.attempts ?? 0} ${
                  m.attempts === 1 ? "attempt" : "attempts"
                }`}
                viz={<MissionLineViz attempts={[]} highlight={null} bands={m.bands} height={120} />}
              />
            </li>
          ))}
        </ul>
      )}
    </PageScaffold>
  );
}
