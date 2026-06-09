import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-5 gap-3 text-center">
      <p className="font-display text-2xl tracking-tight">Lost the trail</p>
      <p className="text-sm text-[var(--muted)]">That page doesn&apos;t exist.</p>
      <Link
        href="/"
        className="mt-1 rounded-full bg-[var(--accent)] text-black text-sm font-semibold px-4 py-2 active:opacity-80"
      >
        Back to Feed
      </Link>
    </div>
  );
}
