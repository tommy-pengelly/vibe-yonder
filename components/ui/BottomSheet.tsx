"use client";
import { X } from "lucide-react";
import { useEffect } from "react";
import type { ReactNode } from "react";

// The standard transient control: a mobile-first bottom sheet (scrim, rounded
// top, drag affordance, Esc/scrim close). The idiom for share, places-seen
// editing, "go here now", add-place — every sheet in the app.
export default function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/50"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md mx-auto bg-[var(--surface)] border-t border-[var(--border)] rounded-t-2xl px-5 pt-3 pb-8 flex flex-col gap-4 max-h-[85dvh] overflow-y-auto"
      >
        <div className="mx-auto h-1 w-9 rounded-full bg-[var(--border)]" />
        {title && (
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="size-8 -mr-1 rounded-full flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <X className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
