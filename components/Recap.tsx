"use client";
import { Bookmark, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { fmtDist, fmtDuration } from "@/lib/geo";
import { projectTrack, summarize } from "@/lib/stats";
import type { Fix, SavedYonder } from "@/lib/types";
import PlacePhoto from "./PlacePhoto";
import ShareControl from "./ShareControl";

type Props = {
  saved: SavedYonder;
  savedLocally: boolean;
  savedForLater?: boolean;
  onRenameTitle?: (next: string) => void;
  onNewWalk?: () => void;
  onSave?: () => void;
  onDoAgain?: () => void;
  onSaveForLater?: () => void;
  /** Optional secondary line under Save, e.g. "Sign in to keep across devices." */
  signedInHint?: React.ReactNode;
};

const W = 420;
const H = 320;

export default function Recap({
  saved,
  savedLocally,
  savedForLater,
  onRenameTitle,
  onNewWalk,
  onSave,
  onDoAgain,
  onSaveForLater,
  signedInHint,
}: Props) {
  const summary = useMemo(
    () => summarize(saved.track, saved.startedAt, saved.pausedMs, saved.endedAt),
    [saved],
  );
  const points = useMemo(
    () => projectTrack(saved.track as Fix[], W, H),
    [saved.track],
  );

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

  useEffect(() => {
    setDraft(saved.name);
  }, [saved.name]);

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

  return (
    <div className="flex-1 flex flex-col w-full max-w-md mx-auto px-5 pt-6 pb-10 gap-6">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
            Walk recap
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
              className="font-display text-3xl tracking-tight text-left truncate hover:text-[var(--accent)] disabled:hover:text-[var(--foreground)]"
              title={onRenameTitle ? "Tap to rename" : undefined}
            >
              {saved.name}
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
            <path
              d={pathD}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
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

      <p className="font-display text-3xl tracking-tight text-center leading-tight">
        You yondered{" "}
        <span className="text-[var(--accent)]">{yonderedDisplay}×</span>.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Tile label="Walked" value={fmtDist(summary.walked)} />
        <Tile label="Time" value={fmtDuration(summary.durationMs)} />
        <Tile label="Direct" value={fmtDist(summary.direct)} />
        <Tile label="Yondered" value={`${yonderedDisplay}×`} hero />
      </div>

      {saved.destinations.length > 0 && (
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
                <div className="min-w-0">
                  <div className="font-display text-base truncate">
                    {d.name}
                  </div>
                  {d.label && (
                    <div className="text-xs text-[var(--muted)] truncate">
                      {d.label}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
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
        <ShareControl saved={saved} />
        {(onDoAgain || onSaveForLater) && (
          <div className="flex items-center gap-2">
            {onDoAgain && (
              <button
                type="button"
                onClick={onDoAgain}
                className="flex-1 rounded-full border border-[var(--border)] text-[var(--foreground)] py-2.5 flex items-center justify-center gap-2 hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                <RotateCcw className="w-4 h-4" strokeWidth={1.75} />
                Do again
              </button>
            )}
            {onSaveForLater && (
              <button
                type="button"
                onClick={onSaveForLater}
                disabled={savedForLater}
                className="flex-1 rounded-full border border-[var(--border)] text-[var(--foreground)] py-2.5 flex items-center justify-center gap-2 hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40 disabled:hover:border-[var(--border)] disabled:hover:text-[var(--foreground)]"
              >
                <Bookmark className="w-4 h-4" strokeWidth={1.75} />
                {savedForLater ? "Saved" : "Save for later"}
              </button>
            )}
          </div>
        )}
        {onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={savedLocally}
            className="rounded-full border border-[var(--accent)]/60 text-[var(--accent)] font-semibold py-3 hover:bg-[var(--accent)] hover:text-black disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[var(--accent)]"
          >
            {savedLocally ? "Saved ✓" : "Save"}
          </button>
        )}
        {signedInHint && (
          <p className="text-[11px] text-[var(--muted)] text-center">
            {signedInHint}
          </p>
        )}
        {onNewWalk && (
          <button
            type="button"
            onClick={onNewWalk}
            className="rounded-full bg-[var(--accent)] text-black font-semibold py-3 active:opacity-80"
          >
            New walk
          </button>
        )}
      </div>
    </div>
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
