"use client";
import { Ruler } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import MissionLineViz from "@/components/MissionLineViz";
import { EmptyState, PageHeader, PageScaffold } from "@/components/ui";
import { useAuthUser } from "@/lib/auth";
import { getMission, loadLeaderboard, type LeaderRow, type Mission } from "@/lib/data";
import { fmtDist } from "@/lib/geo";
import { MEDAL_LABEL } from "@/lib/straightline";

export default function MissionScoreboard({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useAuthUser();
  const [mission, setMission] = useState<Mission | null>(null);
  const [board, setBoard] = useState<LeaderRow[] | null>(null);
  const [highlight, setHighlight] = useState<number | null>(null);

  useEffect(() => {
    let c = false;
    void getMission(id).then((m) => !c && setMission(m));
    void loadLeaderboard(id).then((b) => !c && setBoard(b));
    return () => {
      c = true;
    };
  }, [id, user]);

  const attempt = () => {
    if (!mission || typeof window === "undefined") return;
    window.sessionStorage.setItem(
      "vibe-yonder.start",
      JSON.stringify({
        mode: "single",
        play: "straightline",
        missionId: mission.id,
        origin: mission.a, // everyone walks the same A→B
        name: mission.name ?? "Straight-line mission",
        targets: [
          {
            id: crypto.randomUUID(),
            name: mission.name ?? "The far point",
            lat: mission.b.lat,
            lon: mission.b.lon,
            visited: false,
          },
        ],
      }),
    );
    router.push("/walk");
  };

  return (
    <PageScaffold>
      <PageHeader
        kicker="Straight-line mission"
        title={mission?.name ?? "Hold the line"}
        backHref="/missions"
      />

      {mission && (
        <p className="text-sm text-[var(--warm)] -mt-2">
          {mission.who} · {fmtDist(mission.distanceM)} as the crow flies ·{" "}
          {mission.attempts ?? board?.length ?? 0} on the board
        </p>
      )}

      {board && board.some((r) => r.path && r.path.length > 1) && (
        <div className="flex flex-col gap-1.5">
          <MissionLineViz attempts={board} highlight={highlight} />
          <p className="text-[10px] uppercase tracking-widest text-[var(--muted)] text-center">
            Every run, held against the line · tap a name to trace it
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={attempt}
        className="rounded-full bg-[var(--accent)] text-black font-semibold py-3 flex items-center justify-center gap-2 active:opacity-80"
      >
        <Ruler className="w-4 h-4" strokeWidth={1.75} />
        Attempt this line
      </button>

      {board === null ? null : board.length === 0 ? (
        <EmptyState
          icon={Ruler}
          title="No attempts yet"
          body="Be the first to hold this line. Your best run lands on the board."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--border)]">
          {board.map((r, i) => (
            <li key={r.userId}>
              <button
                type="button"
                onClick={() => setHighlight((h) => (h === i ? null : i))}
                className={`w-full text-left flex items-center gap-3 py-3 ${
                  highlight === i
                    ? "text-[var(--accent)]"
                    : r.isMe
                      ? "text-[var(--warm)]"
                      : ""
                }`}
              >
                <span className="font-mono text-sm text-[var(--muted)] w-6 tabular-nums shrink-0">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-base truncate">
                    {r.handle}
                    {r.isMe && " · you"}
                  </div>
                  <div className="text-[11px] text-[var(--muted)] font-mono">
                    {MEDAL_LABEL[r.medal]} · avg {fmtDist(r.avgDeviation)} off
                  </div>
                </div>
                <div className="font-mono text-sm tabular-nums shrink-0">
                  {fmtDist(r.maxDeviation)}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </PageScaffold>
  );
}
