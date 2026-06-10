"use client";
// Shared presentational feed cards, used by Feed (Following) and Explore
// (Community). Pure UI driven by props; interaction state lives in
// useFeedActions.
import { Bookmark, Copy, Navigation, Sprout } from "lucide-react";
import Link from "next/link";
import { DotMap, Trace } from "@/components/ui/viz";
import { fmtDist } from "@/lib/geo";
import type { FeedMap, FeedYonder } from "@/lib/types";

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

export function YonderCard({
  y,
  grub,
  saved,
  onGrub,
  onSave,
  onLoad,
}: {
  y: FeedYonder;
  grub: { count: number; active: boolean };
  saved: boolean;
  onGrub: () => void;
  onSave: () => void;
  onLoad: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <Link href={`/u/${y.handle.slice(1)}`} className="flex items-center gap-2.5 px-3.5 pt-3.5">
        <Avatar name={y.who} />
        <div className="min-w-0 flex-1">
          <div className="font-display text-base leading-tight truncate hover:text-[var(--accent)]">{y.who}</div>
          <div className="text-[11px] text-[var(--muted)]">
            {y.handle} · {y.when}
          </div>
        </div>
      </Link>
      {y.caption && <p className="text-sm leading-relaxed mx-3.5 mt-2.5 text-pretty">{y.caption}</p>}
      <Link href={`/yonder/${y.id}`} className="relative mt-3 block">
        <Trace points={y.trace} height={150} scaleLabel={fmtDist(y.walked)} />
        <div className="absolute left-4 bottom-2.5 font-mono text-[11px] text-[var(--muted)]">{y.area}</div>
        <div className="absolute right-4 top-3 text-right">
          <div className="font-display text-[26px] leading-none text-[var(--accent)] tabular-nums tracking-tight">
            {fmtYondered(y.yondered)}×
          </div>
          <div className="text-[9px] uppercase tracking-[0.16em] text-[var(--muted)] mt-0.5">Yondered</div>
        </div>
      </Link>
      <div className="font-mono text-[11px] text-[var(--muted)] px-3.5 pt-3 tabular-nums">
        {fmtDist(y.walked)} · {y.mins} min · {y.places} {y.places === 1 ? "place" : "places"} seen
      </div>
      <div className="flex items-center gap-2 px-3.5 pt-2 pb-3.5">
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
        <LoadButton onClick={onLoad} label="Yonder this" />
      </div>
    </div>
  );
}

export function MapCard({
  m,
  grub,
  duped,
  onGrub,
  onLoad,
  onDuplicate,
}: {
  m: FeedMap;
  grub: { count: number; active: boolean };
  duped: boolean;
  onGrub: () => void;
  onLoad: () => void;
  onDuplicate: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="flex items-start justify-between gap-2.5 px-3.5 pt-3.5">
        <div className="min-w-0">
          <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">Collection</span>
          <div className="font-display text-[19px] mt-1 leading-tight">{m.name}</div>
          <Link href={`/u/${m.who.slice(1)}`} className="text-[11px] text-[var(--muted)] mt-0.5 hover:text-[var(--accent)]">
            {m.who}
          </Link>
        </div>
        <GrubButton count={grub.count} active={grub.active} onToggle={onGrub} />
      </div>
      <div className="mt-3">
        <DotMap points={m.previewDots} height={110} />
      </div>
      <div className="font-mono text-[11px] text-[var(--muted)] px-3.5 pt-2.5 tabular-nums">
        {m.places} {m.places === 1 ? "place" : "places"}
      </div>
      <div className="flex items-center gap-2 px-3.5 pt-2.5 pb-3.5">
        <LoadButton onClick={onLoad} label="Yonder this map" />
        <button
          type="button"
          onClick={onDuplicate}
          disabled={duped}
          className="inline-flex items-center gap-1.5 text-[13px] text-[var(--muted)] hover:text-[var(--foreground)] py-1.5 px-1 disabled:opacity-50"
        >
          <Copy className="w-[15px] h-[15px]" strokeWidth={1.75} />
          {duped ? "Duplicated" : "Duplicate"}
        </button>
      </div>
    </div>
  );
}

export function LoadButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/60 bg-black/30 backdrop-blur-sm text-[var(--accent)] text-xs font-semibold px-3 py-1.5 hover:bg-[var(--accent)] hover:text-black"
    >
      <Navigation className="w-3.5 h-3.5" strokeWidth={1.75} />
      {label}
    </button>
  );
}

export function GrubButton({ count, active, onToggle }: { count: number; active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 py-1.5 font-mono text-[13px] tabular-nums transition-colors ${
        active ? "text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
      }`}
    >
      <Sprout className="w-[17px] h-[17px]" strokeWidth={1.75} />
      {count}
    </button>
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

