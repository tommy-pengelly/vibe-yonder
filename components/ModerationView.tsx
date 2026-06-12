"use client";
import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useGoBack } from "@/components/ui";
import { useAuthUser } from "@/lib/auth";
import {
  amAdmin,
  loadPlanConfig,
  loadPlusMembers,
  loadReports,
  type PlanConfig,
  resolveReport,
  setFeatureGate,
  setMeterLimit,
  setPlusByUsername,
} from "@/lib/data";
import {
  FEATURE_KEYS,
  FEATURE_LABEL,
  type FeatureKey,
  METER_KEYS,
  METER_LABEL,
  type MeterKey,
} from "@/lib/plans";
import type { ReportItem } from "@/lib/types";

export default function ModerationView() {
  const goBack = useGoBack("/you");
  const { user } = useAuthUser();
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [showResolved, setShowResolved] = useState(false);
  const [entUser, setEntUser] = useState("");
  const [entMsg, setEntMsg] = useState<string | null>(null);
  const [members, setMembers] = useState<{ handle: string; status: string }[]>([]);
  const [plan, setPlan] = useState<PlanConfig | null>(null);

  const refreshMembers = () => void loadPlusMembers().then(setMembers);

  useEffect(() => {
    let c = false;
    void amAdmin().then((a) => {
      if (c) return;
      setAdmin(a);
      if (a) {
        void loadReports().then((r) => !c && setReports(r));
        void loadPlusMembers().then((m) => !c && setMembers(m));
        void loadPlanConfig().then((p) => !c && setPlan(p));
      }
    });
    return () => {
      c = true;
    };
  }, [user]);

  const toggleGate = (f: FeatureKey, plus: boolean) => {
    setPlan((p) => (p ? { ...p, plusFeatures: { ...p.plusFeatures, [f]: plus } } : p));
    void setFeatureGate(f, plus);
  };
  const changeMeter = (m: MeterKey, free: number) => {
    setPlan((p) =>
      p ? { ...p, meters: { ...p.meters, [m]: { ...p.meters[m], free } } } : p,
    );
    void setMeterLimit(m, free);
  };

  const setPlus = async (on: boolean) => {
    const name = entUser.trim();
    if (!name) return;
    const ok = await setPlusByUsername(name, on);
    setEntMsg(ok ? `${on ? "Granted" : "Revoked"} Yonder+ for @${name.replace(/^@/, "")}` : `No user @${name.replace(/^@/, "")}`);
    if (ok) {
      setEntUser("");
      refreshMembers();
    }
  };

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
            <button type="button" onClick={goBack} aria-label="Back" className="size-9 -ml-2 rounded-full flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)]">
              <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
            </button>
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

        <section className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] p-4">
          <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
            Yonder+ (comp accounts)
          </span>
          <div className="flex items-center gap-2">
            <input
              value={entUser}
              onChange={(e) => setEntUser(e.target.value)}
              placeholder="@username"
              className="flex-1 min-w-0 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
            <button
              type="button"
              onClick={() => void setPlus(true)}
              className="rounded-lg bg-[var(--accent)] text-black text-sm font-semibold px-3 py-2 active:opacity-80"
            >
              Grant
            </button>
            <button
              type="button"
              onClick={() => void setPlus(false)}
              className="rounded-lg border border-[var(--border)] text-[var(--muted)] text-sm px-3 py-2 hover:text-red-400"
            >
              Revoke
            </button>
          </div>
          {entMsg && <p className="text-xs text-[var(--muted)]">{entMsg}</p>}
          {members.length > 0 && (
            <ul className="flex flex-col gap-1 pt-1">
              {members.map((m) => (
                <li key={m.handle} className="flex items-center justify-between text-sm">
                  <span>{m.handle}</span>
                  <span className="text-[11px] text-[var(--muted)] font-mono">{m.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {plan && (
          <section className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] p-4">
            <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
              Gating &amp; meters
            </span>
            <p className="text-xs text-[var(--muted)] -mt-1">
              Toggle what needs Yonder+ and set the free allowances. Live, no deploy.
            </p>
            {FEATURE_KEYS.map((f) => (
              <div key={f} className="flex items-center justify-between gap-3 text-sm">
                <span>{FEATURE_LABEL[f]}</span>
                <button
                  type="button"
                  onClick={() => toggleGate(f, !plan.plusFeatures[f])}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    plan.plusFeatures[f]
                      ? "bg-[var(--accent)] text-black"
                      : "border border-[var(--border)] text-[var(--muted)]"
                  }`}
                >
                  {plan.plusFeatures[f] ? "Yonder+" : "Free"}
                </button>
              </div>
            ))}
            <div className="h-px bg-[var(--border)] my-1" />
            {METER_KEYS.map((m) => (
              <label key={m} className="flex items-center justify-between gap-3 text-sm">
                <span>{METER_LABEL[m]}</span>
                <input
                  type="number"
                  min={0}
                  value={plan.meters[m].free}
                  onChange={(e) => changeMeter(m, Number(e.target.value) || 0)}
                  className="w-16 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-right text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
                />
              </label>
            ))}
          </section>
        )}

        <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
          Report queue
        </span>
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
