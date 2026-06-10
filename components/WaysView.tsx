"use client";
import { Footprints, Send } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import AuthModal from "@/components/AuthModal";
import { BottomSheet, EmptyState, PageHeader, PageScaffold } from "@/components/ui";
import { Traces } from "@/components/ui/viz";
import { useAuthUser } from "@/lib/auth";
import { createWaysPost, loadYonders } from "@/lib/data";
import { fmtDist, haversine, toUnitBoxMulti } from "@/lib/geo";
import type { SavedYonder, Visibility } from "@/lib/types";

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
  const km = (yonders?.reduce((s, y) => s + y.walked, 0) ?? 0) / 1000;
  const placesSeen = useMemo(() => {
    const set = new Set<string>();
    for (const y of yonders ?? [])
      for (const d of y.destinations)
        set.add(`${d.name}|${d.lat.toFixed(4)},${d.lon.toFixed(4)}`);
    return set.size;
  }, [yonders]);

  const [postOpen, setPostOpen] = useState(false);
  const [posted, setPosted] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const postReport = async (caption: string, visibility: Exclude<Visibility, "private">) => {
    if (!yonders) return;
    setPostOpen(false);
    const ok = await createWaysPost({
      caption,
      visibility,
      payload: {
        count: yonders.length,
        km,
        placesSeen,
        traces: toUnitBoxMulti(yonders.map((y) => y.track)),
        title,
      },
    });
    if (ok) setPosted(true);
  };

  return (
    <PageScaffold>
      <PageHeader
        kicker="Explore your own"
        title={title}
        backHref="/you"
        action={
          yonders && yonders.length > 0 ? (
            <button
              type="button"
              onClick={() => (user ? setPostOpen(true) : setAuthOpen(true))}
              disabled={posted}
              aria-label="Post a ways report"
              className="h-9 px-3 rounded-full bg-[var(--accent)] text-black text-sm font-semibold flex items-center gap-1.5 active:opacity-80 disabled:opacity-40"
            >
              <Send className="w-4 h-4" strokeWidth={1.75} />
              {posted ? "Posted" : "Post"}
            </button>
          ) : undefined
        }
      />

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
            {placesSeen} places · {fmtDist(km * 1000)} wandered
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

      <PostWaysSheet open={postOpen} onClose={() => setPostOpen(false)} onPost={postReport} />
      <AuthModal
        open={authOpen}
        reason="Sign in to post a ways report."
        onClose={() => setAuthOpen(false)}
      />
    </PageScaffold>
  );
}

function PostWaysSheet({
  open,
  onClose,
  onPost,
}: {
  open: boolean;
  onClose: () => void;
  onPost: (caption: string, visibility: Exclude<Visibility, "private">) => void;
}) {
  const [caption, setCaption] = useState("");
  const [vis, setVis] = useState<Exclude<Visibility, "private">>("public");
  return (
    <BottomSheet open={open} onClose={onClose} title="Post a ways report">
      <p className="text-xs text-[var(--muted)] -mt-1">
        Share your overlaid wanders to the feed — your traces are shown as a
        normalised memento, never precise coordinates.
      </p>
      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Say a word about your wanderings… (optional)"
        rows={2}
        className="w-full resize-none rounded-xl bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]/60"
      />
      <div className="flex gap-2 text-xs">
        {(["public", "followers"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setVis(v)}
            className={`rounded-full px-3 py-1.5 border capitalize transition-colors ${
              vis === v
                ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--surface-2)]"
                : "border-[var(--border)] text-[var(--muted)]"
            }`}
          >
            {v}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onPost(caption, vis)}
        className="rounded-full bg-[var(--accent)] text-black font-semibold py-3 active:opacity-80"
      >
        Post to feed
      </button>
    </BottomSheet>
  );
}
