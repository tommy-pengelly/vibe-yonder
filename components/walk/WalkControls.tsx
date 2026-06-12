import { Pause } from "lucide-react";
import type { ReactNode } from "react";

// The active-walk control cluster. Paused: Discard · Resume · Finish. Running:
// (Pause) · extra slot · Finish. `pausable={false}` drops pause entirely (a
// mission line is short and continuous), keeping the layout via a spacer.
export default function WalkControls({
  paused,
  pausable = true,
  onPause,
  onResume,
  onFinish,
  onDiscard,
  finishLabel = "Finish",
  extra,
}: {
  paused: boolean;
  pausable?: boolean;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  onDiscard: () => void;
  finishLabel?: string;
  extra?: ReactNode;
}) {
  if (paused) {
    return (
      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={onDiscard}
          className="text-xs text-[var(--muted)] hover:text-red-400 px-2 py-1"
        >
          Discard
        </button>
        <button
          type="button"
          onClick={onResume}
          className="rounded-full bg-[var(--accent)] text-black font-semibold px-6 py-2.5 active:opacity-80"
        >
          Resume
        </button>
        <button
          type="button"
          onClick={onFinish}
          className="text-xs text-[var(--foreground)] hover:text-[var(--accent)] px-2 py-1"
        >
          {finishLabel}
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-3 pt-1">
      {pausable ? (
        <button
          type="button"
          onClick={onPause}
          aria-label="Pause"
          className="size-11 rounded-full border border-[var(--border)] flex items-center justify-center text-[var(--foreground)] hover:border-[var(--accent)] bg-black/30 backdrop-blur-sm"
        >
          <Pause className="w-4 h-4" strokeWidth={1.75} />
        </button>
      ) : (
        <span className="size-11" />
      )}
      <div className="flex-1 flex justify-center">{extra}</div>
      <button
        type="button"
        onClick={onFinish}
        className="rounded-full border border-[var(--accent)]/60 text-[var(--accent)] font-semibold px-5 py-2 hover:bg-[var(--accent)] hover:text-black bg-black/30 backdrop-blur-sm"
      >
        {finishLabel}
      </button>
    </div>
  );
}
