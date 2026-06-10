"use client";
import { Heart, Navigation, X } from "lucide-react";
import PlacePhoto from "@/components/PlacePhoto";
import BottomSheet from "@/components/ui/BottomSheet";
import { CATEGORIES, categoryByKey } from "@/lib/nearby";
import { fmtDist } from "@/lib/geo";
import type { ScopeCandidate } from "@/hooks/useDiscovery";

// The one place all live suggestions surface — the deliberate "show me what's
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
  hideNumbers: boolean;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Around you" minHeightVh={72}>
      <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-3 [scrollbar-width:none]">
        {CATEGORIES.map((c) => {
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

      {suggestions.length === 0 ? (
        <p className="text-sm text-[var(--muted)] py-10 text-center">
          Nothing&apos;s caught the light yet — keep wandering, eyes up.
        </p>
      ) : (
        <div className="flex gap-3 overflow-x-auto -mx-5 px-5 pb-2 snap-x snap-mandatory [scrollbar-width:none]">
          {suggestions.map((c) => (
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

      <button
        type="button"
        onClick={onTurnOff}
        className="mt-4 mx-auto block text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        Turn off suggestions for this wander
      </button>
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
