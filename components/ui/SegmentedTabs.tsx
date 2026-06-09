"use client";

type Tab<T extends string> = { value: T; label: string };

// Two shapes, one control:
//  - "underline": big Fraunces tabs (Feed: Mine/Following/Community)
//  - "pill": small chips (Explore: Recent/Popular, Explorers/Places)
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
  if (variant === "pill") {
    return (
      <div role="tablist" className={`flex gap-2 text-xs ${className}`}>
        {tabs.map((t) => {
          const active = t.value === value;
          return (
            <button
              key={t.value}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => onChange(t.value)}
              className={`rounded-full px-3 py-1 transition-colors ${
                active
                  ? "bg-[var(--surface)] border border-[var(--accent)] text-[var(--accent)]"
                  : "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div role="tablist" className={`flex gap-6 ${className}`}>
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(t.value)}
            className={`font-display text-2xl tracking-tight pb-1 border-b-2 transition-colors ${
              active
                ? "text-[var(--foreground)] border-[var(--accent)]"
                : "text-[var(--muted)] border-transparent hover:text-[var(--warm)]"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
