"use client";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Drawer } from "vaul";

// The standard transient control, now backed by vaul (Radix-style): real
// drag-to-dismiss, focus trap, scroll lock, body-portal stacking (no more
// z-index fights between nested sheets). Same props as before so every caller
// upgrades for free.
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
  return (
    <Drawer.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 mt-24 flex flex-col rounded-t-2xl border-t border-[var(--border)] bg-[var(--surface)] outline-none"
        >
          <div className="w-full max-w-md mx-auto px-5 pt-3 pb-8 flex flex-col gap-4 max-h-[85dvh] overflow-y-auto">
            <div className="mx-auto h-1 w-9 rounded-full bg-[var(--border)]" />
            <div className="flex items-center justify-between">
              <Drawer.Title
                className={title ? "font-display text-xl" : "sr-only"}
              >
                {title ?? "Sheet"}
              </Drawer.Title>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="size-8 -mr-1 rounded-full flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
