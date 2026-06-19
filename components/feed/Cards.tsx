"use client";
// Shared presentational feed cards. One skeleton for every item: a tappable
// card (the whole thing opens its detail) with a social footer (grub + Save).
// The primary action (Yonder this / Attempt) lives on the detail you open.
import { Bookmark, Navigation, Ruler, Sprout } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { DotMap, Trace, Traces } from "@/components/ui/viz";
import { fmtDist } from "@/lib/geo";
import { MEDAL_LABEL } from "@/lib/straightline";
import type { Mission } from "@/lib/data";
import type { FeedMap, FeedMission, FeedWays, FeedYonder } from "@/lib/types";

export { DotMap, Trace } from "@/components/ui/viz";

export function fmtYondered(v: number): string {
  return v >= 10 ? Math.round(v).toString() : v.toFixed(v >= 2 ? 1 : 2);
}

export function Loading() {
  return <p className="text-sm text-[var(--muted)] py-16 text-center">Loading…</p>;
}

export function Empty({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-16 px-2">
      <h2 className="font-display text-2xl tracking-tight">{title}</h2>
      <p className="text-sm text-[var(--muted)] max-w-xs leading-relaxed">{body}</p>
      {cta && (
        <button
          type="button"
          onClick={cta.onClick}
          className="mt-1 rounded-full bg-[var(--accent)] text-black text-sm font-semibold px-5 py-2.5 active:opacity-80"
        >
          {cta.label}
        </button>
      )}
    </div>
  );
}

// ---- Shared skeleton --------------------------------------------------------

// The whole card opens its detail. Inner links/buttons stopPropagation so they
// act on their own without triggering the card navigation.
export function CardShell({ href, children }: { href: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(href);
      }}
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden cursor-pointer hover:border-[var(--accent)]/40 transition-colors"
    >
      {children}
    </div>
  );
}

function CardHeader({
  who,
  handle,
  when,
  tag,
}: {
  who: string;
  handle: string;
  when: string;
  tag?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 px-3.5 pt-3.5">
      <Link
        href={`/u/${handle.slice(1)}`}
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-2.5 min-w-0 flex-1"
      >
        <Avatar name={who} />
        <div className="min-w-0 flex-1">
          <div className="font-display text-base leading-tight truncate hover:text-[var(--accent)]">
            {who}
          </div>
          {when && (
            <div className="text-[11px] text-[var(--muted)]">
              {handle} · {when}
            </div>
          )}
        </div>
      </Link>
      {tag && (
        <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] shrink-0">
          {tag}
        </span>
      )}
    </div>
  );
}

function Caption({ text }: { text: string | null }) {
  if (!text) return null;
  return <p className="text-sm leading-relaxed mx-3.5 mt-2.5 text-pretty">{text}</p>;
}

function Stats({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono text-[11px] text-[var(--muted)] px-3.5 pt-3 tabular-nums">
      {children}
    </div>
  );
}

// Social footer: grub bottom-left (kudos position), Save bottom-right.
function SocialFooter({
  grub,
  onGrub,
  saved,
  onSave,
}: {
  grub: { count: number; active: boolean };
  onGrub: () => void;
  saved: boolean;
  onSave: () => void;
}) {
  return (
    <div
      className="flex items-center px-3.5 pt-2 pb-3.5"
      onClick={(e) => e.stopPropagation()}
    >
      <GrubButton count={grub.count} active={grub.active} onToggle={onGrub} />
      <div className="flex-1" />
      <button
        type="button"
        onClick={onSave}
        disabled={saved}
        className={`inline-flex items-center gap-1.5 text-[13px] py-1.5 px-1 ${
          saved ? "text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
        }`}
      >
        <Bookmark className="w-4 h-4" strokeWidth={1.75} />
        {saved ? "Saved" : "Save"}
      </button>
    </div>
  );
}

// Save (left) + a primary Attempt CTA (right): the action row shared by every
// mission card (feed post and the community catalog). Stops propagation so taps
// hit the buttons, not the card's open-detail navigation.
function SaveAttemptBar({
  saved,
  onSave,
  onAttempt,
}: {
  saved: boolean;
  onSave: () => void;
  onAttempt: () => void;
}) {
  return (
    <div
      className="flex items-center px-3.5 pt-2.5 pb-3.5 gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={onSave}
        disabled={saved}
        className={`inline-flex items-center gap-1.5 text-[13px] py-1.5 px-1 ${
          saved ? "text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
        }`}
      >
        <Bookmark className="w-4 h-4" strokeWidth={1.75} />
        {saved ? "Saved" : "Save"}
      </button>
      <div className="flex-1" />
      <button
        type="button"
        onClick={onAttempt}
        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/60 text-[var(--accent)] text-xs font-semibold px-3 py-1.5 hover:bg-[var(--accent)] hover:text-black"
      >
        <Navigation className="w-3.5 h-3.5" strokeWidth={1.75} />
        Attempt
      </button>
    </div>
  );
}

export function GrubButton({
  count,
  active,
  onToggle,
}: {
  count: number;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      aria-label="Grub"
      className={`inline-flex items-center gap-1.5 py-1.5 font-mono text-[13px] tabular-nums transition-colors ${
        active ? "text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
      }`}
    >
      <Sprout className="w-[17px] h-[17px]" strokeWidth={1.75} />
      {count}
    </button>
  );
}

// ---- Activity: a yonder someone did ----------------------------------------

// The card's visual body (header → media → stats), no shell and no footer. The
// feed card wraps this in CardShell + SocialFooter; the /yonder/[id] detail
// renders it raw with its own action row, so both stay one design.
export function YonderCardBody({
  y,
  traceHeight = 150,
}: {
  y: FeedYonder;
  traceHeight?: number;
}) {
  return (
    <>
      <CardHeader
        who={y.who}
        handle={y.handle}
        when={y.when}
        tag={y.medal ? "Straight line" : undefined}
      />
      <Caption text={y.caption} />
      <div className="relative mt-3">
        <Trace points={y.trace} height={traceHeight} />
        <div className="absolute left-4 bottom-2.5 font-mono text-[11px] text-[var(--muted)]">
          {y.area}
        </div>
        <div className="absolute right-4 top-3 text-right">
          {y.medal ? (
            <>
              <div className="font-display text-[22px] leading-none text-[var(--accent)] tracking-tight">
                {MEDAL_LABEL[y.medal]}
              </div>
              <div className="text-[9px] uppercase tracking-[0.16em] text-[var(--muted)] mt-0.5">
                Straight line
              </div>
            </>
          ) : (
            <>
              <div className="font-display text-[26px] leading-none text-[var(--accent)] tabular-nums tracking-tight">
                {fmtYondered(y.yondered)}×
              </div>
              <div className="text-[9px] uppercase tracking-[0.16em] text-[var(--muted)] mt-0.5">
                Yondered
              </div>
            </>
          )}
        </div>
      </div>
      <Stats>
        {y.medal
          ? `${MEDAL_LABEL[y.medal]} · held the line`
          : `${fmtDist(y.walked)} · ${y.mins} min · ${y.places} ${y.places === 1 ? "place" : "places"} seen`}
      </Stats>
    </>
  );
}

export function YonderCard({
  y,
  grub,
  saved,
  onGrub,
  onSave,
}: {
  y: FeedYonder;
  grub: { count: number; active: boolean };
  saved: boolean;
  onGrub: () => void;
  onSave: () => void;
}) {
  return (
    <CardShell href={`/yonder/${y.id}`}>
      <YonderCardBody y={y} />
      <SocialFooter grub={grub} onGrub={onGrub} saved={saved} onSave={onSave} />
    </CardShell>
  );
}

// ---- Plan: a shared map ----------------------------------------------------

export function MapCard({
  m,
  grub,
  saved,
  onGrub,
  onSave,
}: {
  m: FeedMap;
  grub: { count: number; active: boolean };
  saved: boolean;
  onGrub: () => void;
  onSave: () => void;
}) {
  return (
    <CardShell href={`/maps/${m.mapId ?? m.id}`}>
      <CardHeader who={m.who} handle={m.who} when="" tag="Map" />
      <div className="font-display text-[19px] px-3.5 mt-2 leading-tight">{m.name}</div>
      <div className="mt-2.5">
        <DotMap points={m.previewDots} height={110} />
      </div>
      <Stats>
        {m.places} {m.places === 1 ? "place" : "places"}
      </Stats>
      <SocialFooter grub={grub} onGrub={onGrub} saved={saved} onSave={onSave} />
    </CardShell>
  );
}

// ---- Plan: a straight-line mission -----------------------------------------

export function MissionCard({
  mi,
  saved,
  onSave,
  onAttempt,
}: {
  mi: FeedMission;
  saved: boolean;
  onSave: () => void;
  onAttempt: () => void;
}) {
  return (
    <CardShell href={`/missions/${mi.missionId}`}>
      <CardHeader who={mi.who} handle={mi.handle} when={mi.when} tag="Mission" />
      <div className="flex items-center gap-2 px-3.5 pt-2.5">
        <Ruler className="w-4 h-4 text-[var(--accent)] shrink-0" strokeWidth={1.75} />
        <div className="font-display text-[17px] truncate leading-tight">{mi.name}</div>
      </div>
      <Stats>A {fmtDist(mi.distanceM)} line to hold</Stats>
      {mi.top && mi.top.length > 0 ? (
        <ol className="flex flex-col gap-1.5 px-3.5 pt-2.5">
          {mi.top.map((t, i) => (
            <li key={t.handle + i} className="flex items-center gap-2.5 text-sm">
              <span className="font-mono text-[var(--muted)] w-4 tabular-nums">{i + 1}</span>
              <span className="truncate flex-1">{t.handle}</span>
              <span className="text-[var(--accent)] font-display text-[13px]">
                {MEDAL_LABEL[t.medal]}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-[var(--muted)] px-3.5 pt-1.5">
          No attempts yet, be the first to hold it.
        </p>
      )}
      <SaveAttemptBar saved={saved} onSave={onSave} onAttempt={onAttempt} />
    </CardShell>
  );
}

// ---- Plan: a mission in the community catalog ------------------------------
// The browse-tab card. Same shell + action bar as the feed MissionCard, but a
// catalog header (no author/podium): the whole card opens /missions/[id].

export function MissionBrowseCard({
  m,
  saved,
  onSave,
  onAttempt,
}: {
  m: Mission;
  saved: boolean;
  onSave: () => void;
  onAttempt: () => void;
}) {
  return (
    <CardShell href={`/missions/${m.id}`}>
      <div className="flex items-center gap-2 px-3.5 pt-3.5">
        <Ruler className="w-4 h-4 text-[var(--accent)] shrink-0" strokeWidth={1.75} />
        <div className="font-display text-[17px] truncate leading-tight">
          {m.name ?? "Straight-line mission"}
        </div>
      </div>
      <Stats>
        {m.who} · {fmtDist(m.distanceM)} line · {m.attempts ?? 0}{" "}
        {m.attempts === 1 ? "attempt" : "attempts"}
      </Stats>
      <SaveAttemptBar saved={saved} onSave={onSave} onAttempt={onAttempt} />
    </CardShell>
  );
}

// ---- A ways report ---------------------------------------------------------

export function WaysCard({ w }: { w: FeedWays }) {
  return (
    <CardShell href={`/u/${w.handle.slice(1)}`}>
      <CardHeader who={w.who} handle={w.handle} when={w.when} tag="Ways" />
      <Caption text={w.caption} />
      <div className="mt-3">
        <Traces tracks={w.traces} height={170} />
      </div>
      <Stats>
        {w.placesSeen} places seen · {w.count} ways · {fmtDist(w.km * 1000)} wandered
      </Stats>
      <div className="pb-3.5" />
    </CardShell>
  );
}

export function Avatar({ name }: { name: string }) {
  const initials = name.replace(/[@.]/g, "").slice(0, 2).toUpperCase();
  return (
    <div className="size-10 shrink-0 rounded-full bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center font-display text-sm text-[var(--warm)] tracking-tight">
      {initials}
    </div>
  );
}
