"use client";
import { Bookmark, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePlaceSearch } from "@/hooks/usePlaceSearch";
import { useAuthUser } from "@/lib/auth";
import { createMission, loadLeaderboard } from "@/lib/data";
import { fmtDist, fmtDuration } from "@/lib/geo";
import { projectTrack, summarize } from "@/lib/stats";
import { BAND_PRESETS, DEFAULT_BANDS, MEDAL_LABEL } from "@/lib/straightline";
import type {
  Destination,
  Fix,
  MedalBands,
  RankedResult,
  SavedYonder,
} from "@/lib/types";
import BottomSheet from "./ui/BottomSheet";
import { Twinkle } from "./ui/viz";
import PlacePhoto from "./PlacePhoto";
import ShareControl from "./ShareControl";

type Props = {
  saved: SavedYonder;
  savedForLater?: boolean;
  onRenameTitle?: (next: string) => void;
  /** Leave the recap (go home). Rendered as the primary "Done". Set on the
   * just-finished screen; the saved-history view uses its back arrow instead. */
  onDone?: () => void;
  /** Re-run this outing. Offered on the saved-history view, NOT on the finish
   * screen (where it's confusing). */
  onDoAgain?: () => void;
  onSaveForLater?: () => void;
  /** Persist a note about the wander (written here in the recap). */
  onSaveCaption?: (text: string) => void;
  /** Persist the edited places-seen list. */
  onSavePlaces?: (places: Destination[]) => void;
  /** Throw this yonder away (delete + leave). Two-tap to confirm. */
  onDiscard?: () => void;
  /** Optional secondary line under Save, e.g. "Sign in to keep across devices." */
  signedInHint?: React.ReactNode;
};

const W = 420;
const H = 320;

export default function Recap({
  saved,
  savedForLater,
  onRenameTitle,
  onDone,
  onDoAgain,
  onSaveForLater,
  onSaveCaption,
  onSavePlaces,
  onDiscard,
  signedInHint,
}: Props) {
  const summary = useMemo(
    () => summarize(saved.track, saved.startedAt, saved.pausedMs, saved.endedAt),
    [saved],
  );
  // Project the track AND the places-seen into one frame, so the recap reads as
  // a little constellation: your dotted course threading the place-stars.
  const { points, destPts, corridor } = useMemo(() => {
    const destFix: Fix[] = saved.destinations.map((d) => ({
      lat: d.lat,
      lon: d.lon,
      acc: null,
      t: 0,
    }));
    // A mission/straight-line yonder: project A (origin) into the same frame so
    // we can draw the line A→B and its medal-band corridor (B = first place).
    const slOn =
      saved.play === "straightline" && !!saved.origin && saved.destinations.length > 0;
    const originFix: Fix[] =
      slOn && saved.origin
        ? [{ lat: saved.origin.lat, lon: saved.origin.lon, acc: null, t: 0 }]
        : [];
    const all = projectTrack([...(saved.track as Fix[]), ...destFix, ...originFix], W, H);
    const points = all.slice(0, saved.track.length);
    const destPts = all.slice(saved.track.length, saved.track.length + destFix.length);

    let corridor: {
      a: readonly [number, number];
      b: readonly [number, number];
      bands: { points: string; opacity: number }[];
    } | null = null;
    if (slOn) {
      const a = all[all.length - 1]; // origin (A)
      const b = destPts[0]; // far point (B)
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      const px = -dy / len; // perpendicular unit
      const py = dx / len;
      const widths = saved.straightLine?.bands;
      const bands: { points: string; opacity: number }[] = [];
      if (widths && saved.direct > 0) {
        const mPerPx = saved.direct / len;
        // Widest (bronze) first/under, tightest (platinum) on top + brightest.
        const tiers: [number, number][] = [
          [widths.bronze, 0.05],
          [widths.silver, 0.07],
          [widths.gold, 0.1],
          [widths.platinum, 0.14],
        ];
        for (const [m, opacity] of tiers) {
          const off = m / mPerPx;
          if (!off) continue;
          bands.push({
            points: `${a[0] + px * off},${a[1] + py * off} ${b[0] + px * off},${b[1] + py * off} ${b[0] - px * off},${b[1] - py * off} ${a[0] - px * off},${a[1] - py * off}`,
            opacity,
          });
        }
      }
      corridor = { a, b, bands };
    }
    return { points, destPts, corridor };
  }, [saved.track, saved.destinations, saved.play, saved.origin, saved.straightLine, saved.direct]);

  const pathD = useMemo(() => {
    if (points.length === 0) return "";
    return points
      .map(
        ([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`,
      )
      .join(" ");
  }, [points]);

  const start = points[0];
  const end = points.at(-1);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(saved.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState(saved.caption ?? "");
  const [addOpen, setAddOpen] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    setDraft(saved.name);
  }, [saved.name]);

  useEffect(() => {
    setCaption(saved.caption ?? "");
  }, [saved.caption]);

  const commitCaption = () => {
    const next = caption.trim();
    if (next !== (saved.caption ?? "") && onSaveCaption) onSaveCaption(next);
  };

  const removePlace = (i: number) =>
    onSavePlaces?.(saved.destinations.filter((_, idx) => idx !== i));
  const addPlace = (r: RankedResult) => {
    onSavePlaces?.([
      ...saved.destinations,
      { name: r.name, label: r.label, lat: r.lat, lon: r.lon },
    ]);
    setAddOpen(false);
  };

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commitTitle = () => {
    const next = draft.trim() || saved.name;
    if (next !== saved.name && onRenameTitle) onRenameTitle(next);
    setEditing(false);
  };

  const yonderedDisplay =
    summary.yondered >= 10
      ? Math.round(summary.yondered).toString()
      : summary.yondered.toFixed(summary.yondered >= 2 ? 1 : 2);

  const sl = saved.play === "straightline" ? saved.straightLine : undefined;

  const router = useRouter();
  const { user } = useAuthUser();
  const [missionBusy, setMissionBusy] = useState(false);
  const [makeOpen, setMakeOpen] = useState(false);
  const [placement, setPlacement] = useState<{ pos: number; total: number } | null>(null);

  // A mission attempt: find where you landed on the board. The attempt is
  // recorded on finish, so retry a couple of times in case it's mid-write.
  useEffect(() => {
    if (!sl || !saved.missionId) return;
    let cancelled = false;
    let tries = 0;
    const check = () => {
      void loadLeaderboard(saved.missionId!).then((board) => {
        if (cancelled) return;
        const idx = board.findIndex((r) => r.isMe);
        if (idx >= 0) {
          setPlacement({ pos: idx + 1, total: board.length });
        } else if (tries++ < 3) {
          setTimeout(check, 700);
        }
      });
    };
    check();
    return () => {
      cancelled = true;
    };
  }, [sl, saved.missionId]);

  const makeMission = async (bands: MedalBands) => {
    const b = saved.destinations[0];
    if (!saved.origin || !b || missionBusy) return;
    setMissionBusy(true);
    const id = await createMission({
      name: saved.name,
      a: saved.origin,
      b: { lat: b.lat, lon: b.lon },
      distanceM: saved.direct,
      bands,
    });
    if (id) router.push(`/missions/${id}`);
    else setMissionBusy(false);
  };

  return (
    <div className="flex-1 flex flex-col w-full max-w-md mx-auto px-5 pt-6 pb-10 gap-6">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
            {onRenameTitle ? "Name your wander" : "Walk recap"}
          </span>
          {editing && onRenameTitle ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitTitle();
                if (e.key === "Escape") {
                  setDraft(saved.name);
                  setEditing(false);
                }
              }}
              className="font-display text-3xl tracking-tight bg-transparent outline-none border-b border-[var(--accent)] pb-1"
            />
          ) : (
            <button
              type="button"
              onClick={() => onRenameTitle && setEditing(true)}
              disabled={!onRenameTitle}
              className="group font-display text-3xl tracking-tight text-left flex items-center gap-2 min-w-0 hover:text-[var(--accent)] disabled:hover:text-[var(--foreground)]"
              title={onRenameTitle ? "Tap to name this wander" : undefined}
            >
              <span className="truncate">{saved.name}</span>
              {onRenameTitle && (
                <Pencil
                  className="w-4 h-4 shrink-0 text-[var(--muted)] group-hover:text-[var(--accent)]"
                  strokeWidth={1.75}
                />
              )}
            </button>
          )}
        </div>
      </header>

      <div className="recap-mask">
        {points.length > 1 ? (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto"
            aria-label="Walk path"
          >
            {/* A mission's line + its medal-band corridor (the limits you held
                to), drawn under your course so the wiggle reads against it. */}
            {corridor && (
              <>
                {corridor.bands.map((band, i) => (
                  <polygon key={`band${i}`} points={band.points} fill="var(--accent)" opacity={band.opacity} />
                ))}
                <line
                  x1={corridor.a[0]}
                  y1={corridor.a[1]}
                  x2={corridor.b[0]}
                  y2={corridor.b[1]}
                  stroke="var(--accent)"
                  strokeWidth={1.5}
                  opacity={0.4}
                  strokeDasharray="5 6"
                />
              </>
            )}
            {/* The places you saw, as faint twinkles the course threads. */}
            {destPts.map(([x, y], i) => (
              <Twinkle key={`s${i}`} cx={x} cy={y} r={7} opacity={0.8} />
            ))}
            {/* Your course: a dotted line, warm but quiet, threading the sky. */}
            <path
              d={pathD}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="0.1 9"
              opacity={0.8}
            />
            {start && (
              <circle
                cx={start[0]}
                cy={start[1]}
                r={6}
                fill="none"
                stroke="var(--foreground)"
                strokeWidth={2}
              />
            )}
            {end && (
              <circle cx={end[0]} cy={end[1]} r={6} fill="var(--accent)" />
            )}
          </svg>
        ) : (
          <p className="text-sm text-[var(--muted)] py-12 text-center">
            Not enough movement to draw a path.
          </p>
        )}
      </div>

      {sl ? (
        <div className="flex flex-col items-center gap-1">
          <p className="font-display text-3xl tracking-tight text-center leading-tight">
            <span className="text-[var(--accent)]">{MEDAL_LABEL[sl.medal]}</span>
            {sl.medal === "dnf"
              ? ", you didn't reach the end."
              : sl.medal === "none"
                ? ", you finished the line."
                : ", you held the line."}
          </p>
          {saved.missionId && placement && (
            <p className="text-sm text-[var(--warm)]">
              You came{" "}
              <span className="text-[var(--accent)] font-medium">
                {ordinal(placement.pos)}
              </span>{" "}
              of {placement.total} on this mission.
            </p>
          )}
        </div>
      ) : (
        <p className="font-display text-3xl tracking-tight text-center leading-tight">
          You yondered{" "}
          <span className="text-[var(--accent)]">{yonderedDisplay}×</span>.
        </p>
      )}

      {onSaveCaption && (
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onBlur={commitCaption}
          placeholder="Say a word about this wander…"
          rows={2}
          className="w-full resize-none rounded-xl bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]/60"
        />
      )}

      {sl ? (
        <div className="grid grid-cols-2 gap-3">
          <Tile label="Max off line" value={fmtDist(sl.maxDeviation)} hero />
          <Tile label="Avg off line" value={fmtDist(sl.avgDeviation)} />
          <Tile label="In corridor" value={`${Math.round(sl.inCorridorPct)}%`} />
          <Tile label="Walked" value={fmtDist(summary.walked)} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Tile label="Walked" value={fmtDist(summary.walked)} />
          <Tile label="Time" value={fmtDuration(summary.durationMs)} />
          <Tile label="Direct" value={fmtDist(summary.direct)} />
          <Tile label="Yondered" value={`${yonderedDisplay}×`} hero />
        </div>
      )}

      {sl &&
        (saved.missionId ? (
          <Link
            href={`/missions/${saved.missionId}`}
            className="rounded-full border border-[var(--accent)]/60 text-[var(--accent)] font-semibold py-2.5 text-center hover:bg-[var(--accent)] hover:text-black"
          >
            View the scoreboard
          </Link>
        ) : user && saved.origin && saved.destinations[0] ? (
          <button
            type="button"
            onClick={() => setMakeOpen(true)}
            disabled={missionBusy}
            className="rounded-full border border-[var(--accent)]/60 text-[var(--accent)] font-semibold py-2.5 hover:bg-[var(--accent)] hover:text-black disabled:opacity-40"
          >
            {missionBusy ? "Creating…" : "Make this a mission"}
          </button>
        ) : null)}

      <MakeMissionSheet
        open={makeOpen}
        onClose={() => setMakeOpen(false)}
        busy={missionBusy}
        onCreate={(bands) => void makeMission(bands)}
      />

      {(saved.destinations.length > 0 || onSavePlaces) && (
        <section className="flex flex-col gap-3">
          <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
            Places seen
          </span>
          <ul className="flex flex-col gap-3">
            {saved.destinations.map((d, i) => (
              <li
                key={`${d.lat},${d.lon},${i}`}
                className="flex items-center gap-3"
              >
                <PlacePhoto
                  lat={d.lat}
                  lon={d.lon}
                  name={d.name}
                  keepPlaceholder
                  className="size-14 rounded-xl shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-display text-base truncate">
                    {d.name}
                  </div>
                  {d.label && (
                    <div className="text-xs text-[var(--muted)] truncate">
                      {d.label}
                    </div>
                  )}
                </div>
                {onSavePlaces && (
                  <button
                    type="button"
                    onClick={() => removePlace(i)}
                    aria-label={`Remove ${d.name}`}
                    className="size-8 shrink-0 flex items-center justify-center text-[var(--muted)] hover:text-red-400"
                  >
                    <X className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                )}
              </li>
            ))}
            {saved.destinations.length === 0 && (
              <li className="text-sm text-[var(--muted)]">
                Add the places you wandered past.
              </li>
            )}
          </ul>
          {onSavePlaces && (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="self-start inline-flex items-center gap-1.5 text-sm text-[var(--accent)] hover:opacity-80"
            >
              <Plus className="w-4 h-4" strokeWidth={1.75} />
              Add a place
            </button>
          )}
        </section>
      )}

      <div className="flex items-center justify-center">
        <Link
          href="/explain"
          className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          What do these stats mean?
        </Link>
      </div>

      <div className="flex flex-col gap-2 mt-auto">
        {/* Three things, no more: who can see it, keep the places, leave. */}
        <ShareControl saved={saved} />
        {onSaveForLater && (
          <button
            type="button"
            onClick={onSaveForLater}
            disabled={savedForLater}
            title="Keep these places as a map to wander again"
            className="rounded-full border border-[var(--border)] text-[var(--foreground)] py-2.5 flex items-center justify-center gap-2 hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40 disabled:hover:border-[var(--border)] disabled:hover:text-[var(--foreground)]"
          >
            <Bookmark className="w-4 h-4" strokeWidth={1.75} />
            {savedForLater ? "Saved as a map ✓" : "Save places as a map"}
          </button>
        )}
        {onDoAgain && (
          <button
            type="button"
            onClick={onDoAgain}
            className="rounded-full border border-[var(--border)] text-[var(--foreground)] py-2.5 flex items-center justify-center gap-2 hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <RotateCcw className="w-4 h-4" strokeWidth={1.75} />
            Do again
          </button>
        )}
        {signedInHint && (
          <p className="text-[11px] text-[var(--muted)] text-center">
            {signedInHint}
          </p>
        )}
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="rounded-full bg-[var(--accent)] text-black font-semibold py-3 active:opacity-80"
          >
            Done
          </button>
        )}
        {onDiscard && (
          <button
            type="button"
            onClick={() => (confirmDiscard ? onDiscard() : setConfirmDiscard(true))}
            onBlur={() => setConfirmDiscard(false)}
            className={`self-center inline-flex items-center gap-1.5 text-xs pt-1 ${
              confirmDiscard ? "text-red-400" : "text-[var(--muted)] hover:text-red-400"
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
            {confirmDiscard ? "Tap again to discard" : "Discard this yonder"}
          </button>
        )}
      </div>

      {onSavePlaces && (
        <RecapAddPlace
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onAdd={addPlace}
        />
      )}
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

// Publish a straight line as a mission. The medal bands are front-and-centre so
// the creator tunes how hard their line is, preset quick-fills (Casual /
// Standard / Precision) + raw metres per medal.
function MakeMissionSheet({
  open,
  onClose,
  busy,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  onCreate: (bands: MedalBands) => void;
}) {
  const [custom, setCustom] = useState(true);
  const [bands, setBands] = useState<MedalBands>(DEFAULT_BANDS);
  const keys = ["platinum", "gold", "silver", "bronze"] as const;
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Make this a mission"
      minHeightVh={custom ? 72 : 42}
    >
      <div className="flex flex-col gap-4 pb-2">
        <p className="text-sm text-[var(--muted)] -mt-1">
          Others walk your exact line and race to hold it tightest. Medals reward how
          close they stay.
        </p>

        {!custom ? (
          <div className="flex flex-col gap-3">
            <p className="font-mono text-[11px] text-[var(--muted)] tabular-nums">
              Platinum ≤{bands.platinum}m · Gold ≤{bands.gold}m · Silver ≤{bands.silver}m ·
              Bronze ≤{bands.bronze}m
            </p>
            <button
              type="button"
              onClick={() => setCustom(true)}
              className="self-start text-sm text-[var(--accent)] hover:opacity-80"
            >
              Customise medals
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              {BAND_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setBands(p.bands)}
                  className="rounded-full border border-[var(--border)] px-3 py-1.5 text-sm hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  {p.label}
                </button>
              ))}
            </div>
            {keys.map((k) => (
              <label key={k} className="flex items-center justify-between gap-3 text-sm">
                <span className="font-display text-[var(--accent)]">{MEDAL_LABEL[k]}</span>
                <span className="flex items-center gap-1.5 text-[var(--muted)]">
                  ≤
                  <input
                    type="number"
                    inputMode="decimal"
                    min={1}
                    value={bands[k]}
                    onChange={(e) =>
                      setBands((b) => ({ ...b, [k]: Number(e.target.value) || 0 }))
                    }
                    className="w-20 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-right text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
                  />
                  m
                </span>
              </label>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => onCreate(bands)}
          disabled={busy}
          className="rounded-full bg-[var(--accent)] text-black font-semibold py-3 active:opacity-80 disabled:opacity-40"
        >
          {busy ? "Creating…" : "Create mission"}
        </button>
      </div>
    </BottomSheet>
  );
}

function RecapAddPlace({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (r: RankedResult) => void;
}) {
  const { q, setQ, results, loading } = usePlaceSearch(null);
  return (
    <BottomSheet open={open} onClose={onClose} title="Add a place seen" minHeightVh={60}>
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search a place you saw…"
        className="w-full bg-transparent border-b border-[var(--border)] px-1 py-3 text-base outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]/60"
        inputMode="search"
      />
      <ul className="flex flex-col divide-y divide-[var(--border)] min-h-12">
        {loading && (
          <li className="text-sm text-[var(--muted)] py-2 px-1">Searching…</li>
        )}
        {!loading && q.trim().length >= 3 && results.length === 0 && (
          <li className="text-sm text-[var(--muted)] py-2 px-1">
            No matches. Try adding the town.
          </li>
        )}
        {results.map((r, i) => (
          <li key={`${r.lat},${r.lon},${i}`}>
            <button
              type="button"
              onClick={() => onAdd(r)}
              className="w-full text-left py-3 hover:text-[var(--accent)]"
            >
              <div className="font-display text-base truncate">{r.name}</div>
              <div className="text-xs text-[var(--muted)] line-clamp-1">
                {r.label}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}

function Tile({
  label,
  value,
  hero,
}: {
  label: string;
  value: string;
  hero?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-[var(--border)] px-4 py-4 flex flex-col ${
        hero ? "bg-[var(--surface)]" : "bg-transparent"
      }`}
    >
      <div className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
        {label}
      </div>
      <div
        className={`font-display tabular-nums mt-1 ${
          hero ? "text-3xl text-[var(--accent)]" : "text-2xl"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
