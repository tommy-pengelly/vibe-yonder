"use client";
import { useEffect, useRef } from "react";

// Auto-loads the next page when this sentinel nears the viewport, with a
// "Load more" button as the fallback (no IntersectionObserver, or manual tap).
export default function InfiniteScroll({
  hasMore,
  loading,
  onMore,
}: {
  hasMore: boolean;
  loading: boolean;
  onMore: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || loading) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onMore();
      },
      { rootMargin: "500px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, onMore]);

  if (!hasMore && !loading) return null;
  return (
    <div ref={ref} className="flex justify-center py-3">
      {loading ? (
        <span className="text-sm text-[var(--muted)]">Loading…</span>
      ) : (
        <button
          type="button"
          onClick={onMore}
          className="rounded-full border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--muted)]"
        >
          Load more
        </button>
      )}
    </div>
  );
}
