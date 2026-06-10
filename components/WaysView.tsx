"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { EmptyState, PageHeader, PageScaffold } from "@/components/ui";
import { Traces } from "@/components/ui/viz";
import { useAuthUser } from "@/lib/auth";
import { loadYonders } from "@/lib/data";
import { fmtDist, haversine, toUnitBoxMulti } from "@/lib/geo";
import type { SavedYonder } from "@/lib/types";
import { Footprints } from "lucide-react";

// Every way you've moved — overlaid. Optionally narrowed to yonders that
// involved a place (?near=lat,lon&name=Home → "all the ways I've ventured
// home"). A personal lens on your own tracks.
const NEAR_RADIUS_M = 250;

export default function WaysView() {
  const sp = useSearchParams();
  const { user } = useAuthUser();
  const [all, setAll] = useState<SavedYonder[] | null>(null);

  const near = useMemo(() => {
    const raw = sp.get("near");
    if (!raw) return null;
    const [lat, lon] = raw.split(",").map(Number);
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
  }, [sp]);
  const name = sp.get("name") ?? undefined;

  useEffect(() => {
    let c = false;
    void loadYonders().then((y) => !c && setAll(y));
    return () => {
      c = true;
    };
  }, [user]);

  const yonders = useMemo(() => {
    if (!all) return null;
    if (!near) return all;
    return all.filter((y) =>
      y.destinations.some(
        (d) => haversine(near.lat, near.lon, d.lat, d.lon) < NEAR_RADIUS_M,
      ),
    );
  }, [all, near]);

  const title = name ? `Ways to ${name}` : "Your yonders";
  const km =
    yonders?.reduce((s, y) => s + y.walked, 0) ?? 0;

  return (
    <PageScaffold>
      <PageHeader kicker="Explore your own" title={title} backHref="/you" />

      {yonders === null ? null : yonders.length === 0 ? (
        <EmptyState
          icon={Footprints}
          title={near ? "No ways here yet" : "No yonders yet"}
          body={
            near
              ? "Once you wander to this place, every route you took shows up here, overlaid."
              : "Go wander — every way you move gets drawn here, all together."
          }
        />
      ) : (
        <>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
            <Traces
              tracks={toUnitBoxMulti(yonders.map((y) => y.track))}
              height={240}
            />
          </div>
          <p className="text-sm text-[var(--warm)] text-center">
            {yonders.length} {yonders.length === 1 ? "way" : "ways"} ·{" "}
            {fmtDist(km)} wandered
          </p>
          <ul className="flex flex-col divide-y divide-[var(--border)]">
            {yonders.map((y) => (
              <li key={y.id}>
                <Link
                  href={`/recap/${y.id}`}
                  className="flex items-center justify-between py-3 hover:text-[var(--accent)]"
                >
                  <div className="min-w-0">
                    <div className="font-display text-base truncate">
                      {y.name}
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {new Date(y.endedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </div>
                  <div className="text-xs font-mono text-[var(--accent)] tabular-nums shrink-0">
                    {y.yondered.toFixed(1)}×
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </PageScaffold>
  );
}
