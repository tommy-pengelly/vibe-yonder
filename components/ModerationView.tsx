"use client";
import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthUser } from "@/lib/auth";
import { amAdmin, loadReports, resolveReport } from "@/lib/data";
import type { ReportItem } from "@/lib/types";

export default function ModerationView() {
  const { user } = useAuthUser();
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [showResolved, setShowResolved] = useState(false);

  useEffect(() => {
    let c = false;
    void amAdmin().then((a) => {
      if (c) return;
      setAdmin(a);
      if (a) void loadReports().then((r) => !c && setReports(r));
    });
    return () => {
      c = true;
    };
  }, [user]);

  if (admin === null) return <div className="flex-1" />;
  if (!admin) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-5 gap-3">
        <p className="text-sm text-[var(--muted)]">Moderation is for admins only.</p>
        <Link href="/" className="text-sm text-[var(--accent)] hover:opacity-80">Back to Feed</Link>
      </div>
    );
  }

  const visible = reports.filter((r) => showResolved || !r.resolved);
  const resolve = async (id: string) => {
    setReports((rs) => rs.map((r) => (r.id === id ? { ...r, resolved: true } : r)));
    await resolveReport(id);
  };
  const targetHref = (r: ReportItem) => (r.targetType === "yonder" ? `/yonder/${r.targetId}` : undefined);

  return (
    <>
      <div className="flex-1 flex flex-col w-full max-w-md mx-auto px-5 pt-8 pb-10 gap-5">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/you" aria-label="Back" className="size-9 -ml-2 rounded-full flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)]">
              <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
            </Link>
            <div>
              <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">Admin</span>
              <h1 className="font-display text-2xl tracking-tight leading-none">Moderation</h1>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowResolved((v) => !v)}
            className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            {showResolved ? "Hide resolved" : "Show resolved"}
          </button>
        </header>

        {visible.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Nothing in the queue. A calm community.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {visible.map((r) => {
              const href = targetHref(r);
              return (
                <li key={r.id} className={`rounded-2xl border border-[var(--border)] p-4 ${r.resolved ? "opacity-50" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm">
                        <span className="capitalize">{r.targetType}</span> reported
                        {r.reporter ? ` by @${r.reporter.username}` : ""}
                      </div>
                      {r.reason && <div className="text-xs text-[var(--muted)] mt-1">{r.reason}</div>}
                      <div className="text-[11px] text-[var(--muted)] mt-1">{r.when}</div>
                      {href && (
                        <Link href={href} className="text-xs text-[var(--accent)] hover:opacity-80 mt-1 inline-block">
                          View content
                        </Link>
                      )}
                    </div>
                    {!r.resolved && (
                      <button
                        type="button"
                        onClick={() => void resolve(r.id)}
                        className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] text-xs px-3 py-1.5 hover:border-[var(--accent)] hover:text-[var(--accent)]"
                      >
                        <Check className="w-3.5 h-3.5" strokeWidth={2} /> Resolve
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
