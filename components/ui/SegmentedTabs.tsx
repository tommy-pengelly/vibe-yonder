"use client";
import * as Tabs from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

type Tab<T extends string> = { value: T; label: string };

// A controlled tab selector on Radix Tabs (roving focus, arrow-key nav, aria).
// Callers render their own panels; this is just the list. Two looks:
//  - "underline": big Fraunces tabs (Feed: Mine/Following)
//  - "pill": small chips (Find: Places/Explorers, Recent/Popular)
export default function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  variant = "underline",
  className = "",
}: {
  tabs: Tab<T>[];
  value: T;
  onChange: (v: T) => void;
  variant?: "underline" | "pill";
  className?: string;
}) {
  const pill = variant === "pill";
  return (
    <Tabs.Root value={value} onValueChange={(v) => onChange(v as T)}>
      <Tabs.List className={cn(pill ? "flex gap-2 text-xs" : "flex gap-6", className)}>
        {tabs.map((t) => (
          <Tabs.Trigger
            key={t.value}
            value={t.value}
            className={cn(
              "transition-colors outline-none",
              pill
                ? "rounded-full px-3 py-1 border data-[state=active]:bg-[var(--surface)] data-[state=active]:border-[var(--accent)] data-[state=active]:text-[var(--accent)] data-[state=inactive]:border-[var(--border)] data-[state=inactive]:text-[var(--muted)] data-[state=inactive]:hover:text-[var(--foreground)]"
                : "font-display text-2xl tracking-tight pb-1 border-b-2 data-[state=active]:text-[var(--foreground)] data-[state=active]:border-[var(--accent)] data-[state=inactive]:text-[var(--muted)] data-[state=inactive]:border-transparent data-[state=inactive]:hover:text-[var(--warm)]",
            )}
          >
            {t.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs.Root>
  );
}
