"use client";
import { Eye, EyeOff, Heart, Navigation, Search, X } from "lucide-react";
import { useState } from "react";
import PlacePhoto from "@/components/PlacePhoto";
import BottomSheet from "@/components/ui/BottomSheet";
import { categoryByKey, THEMES } from "@/lib/nearby";
import { fmtDist } from "@/lib/geo";
import type { ScopeCandidate } from "@/hooks/useDiscovery";

// The one place all live suggestions surface, the deliberate "show me what's
// around" view (the scope's constellation stays the eyes-up, mysterious one).
// A swipeable row of cards; each can be taken-next, saved, or declined. The
// guide chips lean what the engine surfaces ("I fancy a coffee").
export default function SuggestionsSheet({
  open,
  onClose,
  suggestions,
  activeGuide,
  onSetGuide,
  onTakeNext,
  onSaveForLater,
  onDecline,
  onTurnOff,
  bearingOnly,
  onToggleBearingOnly,
  hideNumbers,
}: {
  open: boolean;
  onClose: () => void;
  suggestions: ScopeCandidate[];
  activeGuide: string | null;
  onSetGuide: (key: string | null) => void;
  onTakeNext: (id: string) => void;
  onSaveForLater: (c: ScopeCandidate) => void;
  onDecline: (id: string) => void;
  onTurnOff: () => void;
  bearingOnly: boolean;
  onToggleBearingOnly: () => void;
  hideNumbers: boolean;
}) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  // Hone what's around: filter the live suggestions by name/type, no new search
  // of the wider world (that would turn discovery into a directory).
  const shown = term
    ? suggestions.filter((c) =>
        `${c.name ?? ""} ${c.typeLabel ?? ""} ${c.category ?? ""}`
          .toLowerCase()
          .includes(term),
      )
    : suggestions;
  return (
    <BottomSheet open={open} onClose={onClose} title="Around you" minHeightVh={72}>
      <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-3 [scrollbar-width:none]">
        {THEMES.map((c) => {
          const on = activeGuide === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => onSetGuide(on ? null : c.key)}
              aria-pressed={on}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap ${
                on
                  ? "border-[var(--accent)] text-[var(--accent)]"
                  : "border-[var(--border)] text-[var(--muted)]"
              }`}
            >
              {c.emoji} {c.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 mb-3 rounded-full border border-[var(--border)] focus-within:border-[var(--accent)] px-3">
        <Search className="w-4 h-4 shrink-0 text-[var(--muted)]" strokeWidth={1.75} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Hone in… a café, the park, a name"
          className="flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-[var(--muted)]/60"
          inputMode="search"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label="Clear"
            className="text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-[var(--muted)] py-10 text-center">
          {term
            ? "Nothing around matches that, try another word."
            : "Nothing's caught the light yet, keep wandering, eyes up."}
        </p>
      ) : (
        <div className="flex gap-3 overflow-x-auto -mx-5 px-5 pb-2 snap-x snap-mandatory [scrollbar-width:none]">
          {shown.map((c) => (
            <SuggestionCard
              key={c.id}
              c={c}
              hideNumbers={hideNumbers}
              onTakeNext={() => onTakeNext(c.id)}
              onSaveForLater={() => onSaveForLater(c)}
              onDecline={() => onDecline(c.id)}
            />
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={onToggleBearingOnly}
          aria-pressed={bearingOnly}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--accent)]"
        >
          {bearingOnly ? (
            <EyeOff className="w-4 h-4" strokeWidth={1.75} />
          ) : (
            <Eye className="w-4 h-4" strokeWidth={1.75} />
          )}
          {bearingOnly ? "Show the full sky" : "Calm view, just the marker"}
        </button>
        <button
          type="button"
          onClick={onTurnOff}
          className="block text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          Turn off suggestions for this wander
        </button>
      </div>
    </BottomSheet>
  );
}

function SuggestionCard({
  c,
  hideNumbers,
  onTakeNext,
  onSaveForLater,
  onDecline,
}: {
  c: ScopeCandidate;
  hideNumbers: boolean;
  onTakeNext: () => void;
  onSaveForLater: () => void;
  onDecline: () => void;
}) {
  const cat = c.category ? categoryByKey(c.category) : undefined;
  return (
    <div className="snap-center shrink-0 w-[78vw] max-w-xs rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden flex flex-col">
      <PlacePhoto
        lat={c.lat}
        lon={c.lon}
        name={c.name ?? ""}
        keepPlaceholder
        className="w-full h-36"
      />
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap text-[11px]">
            {cat && (
              <span className="text-[var(--muted)]">
                {cat.emoji} {cat.label}
              </span>
            )}
            {c.dist != null && !hideNumbers && (
              <span className="font-mono text-[var(--accent)] tabular-nums">
                {fmtDist(c.dist)}
              </span>
            )}
            {c.wiki && <span className="text-[var(--accent)]">✦ Noted</span>}
          </div>
          <div className="font-display text-xl tracking-tight leading-tight">
            {c.name ?? "Somewhere nearby"}
          </div>
        </div>
        <div className="mt-auto flex flex-col gap-2">
          <button
            type="button"
            onClick={onTakeNext}
            className="rounded-full bg-[var(--accent)] text-black font-semibold py-2.5 flex items-center justify-center gap-2 active:opacity-80"
          >
            <Navigation className="w-4 h-4" strokeWidth={1.75} />
            Take me there next
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSaveForLater}
              className="flex-1 rounded-full border border-[var(--border)] py-2 text-sm flex items-center justify-center gap-1.5 hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              <Heart className="w-4 h-4" strokeWidth={1.75} />
              Save
            </button>
            <button
              type="button"
              onClick={onDecline}
              className="flex-1 rounded-full border border-[var(--border)] py-2 text-sm text-[var(--muted)] flex items-center justify-center gap-1.5 hover:text-[var(--foreground)]"
            >
              <X className="w-4 h-4" strokeWidth={1.75} />
              Not this
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
