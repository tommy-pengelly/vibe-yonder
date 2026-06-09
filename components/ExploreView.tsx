"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import AuthModal from "@/components/AuthModal";
import { Empty, Loading, MapCard, YonderCard } from "@/components/feed/Cards";
import { useFeedActions } from "@/components/feed/useFeedActions";
import { loadCommunity, searchProfiles } from "@/lib/data";
import type { FeedMap, FeedYonder, Profile } from "@/lib/types";

export default function ExploreView() {
  const a = useFeedActions();
  const [pq, setPq] = useState("");
  const [people, setPeople] = useState<Profile[]>([]);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"recent" | "popular">("recent");
  const [community, setCommunity] = useState<{ yonders: FeedYonder[]; maps: FeedMap[] } | null>(null);

  useEffect(() => {
    let c = false;
    const term = pq.trim();
    if (term.length < 2) {
      setPeople([]);
      return;
    }
    const h = setTimeout(() => {
      void searchProfiles(term).then((p) => !c && setPeople(p));
    }, 300);
    return () => {
      c = true;
      clearTimeout(h);
    };
  }, [pq]);

  useEffect(() => {
    let c = false;
    setCommunity(null);
    const h = setTimeout(() => {
      void loadCommunity(q, sort).then((r) => {
        if (c) return;
        setCommunity(r);
        a.seedGrubs(r.yonders);
        a.seedGrubs(r.maps);
      });
    }, q ? 350 : 0);
    return () => {
      c = true;
      clearTimeout(h);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, sort]);

  return (
    <>
      <div className="flex-1 flex flex-col w-full max-w-md mx-auto px-5 pt-10 pb-6 gap-6">
        <header className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">Explore</span>
          <h1 className="font-display text-3xl tracking-tight leading-none">Find your next wander</h1>
        </header>

        <section className="flex flex-col gap-2">
          <input
            value={pq}
            onChange={(e) => setPq(e.target.value)}
            placeholder="Find explorers by name or @handle…"
            className="w-full bg-transparent border-b border-[var(--border)] px-1 py-2.5 text-base outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]/60"
            inputMode="search"
          />
          {people.length > 0 && (
            <ul className="flex flex-col divide-y divide-[var(--border)]">
              {people.map((p) => (
                <li key={p.id}>
                  <Link href={`/u/${p.username}`} className="flex items-center gap-3 py-2.5 hover:text-[var(--accent)]">
                    <div className="size-9 shrink-0 rounded-full bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center font-display text-xs text-[var(--warm)]">
                      {(p.displayName ?? p.username).replace(/[@.]/g, "").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-display text-sm truncate">{p.displayName ?? `@${p.username}`}</div>
                      <div className="text-[11px] text-[var(--muted)]">@{p.username}</div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {pq.trim().length >= 2 && people.length === 0 && (
            <p className="text-sm text-[var(--muted)] px-1">No explorers found.</p>
          )}
        </section>

        <section className="flex flex-col gap-3.5">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the community: a place or area…"
            className="w-full bg-transparent border-b border-[var(--border)] px-1 py-2.5 text-base outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]/60"
            inputMode="search"
          />
          <div className="flex gap-2 text-xs">
            {(["recent", "popular"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSort(s)}
                className={`rounded-full px-3 py-1 capitalize transition-colors ${
                  sort === s
                    ? "bg-[var(--surface)] border border-[var(--accent)] text-[var(--accent)]"
                    : "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {community === null ? (
            <Loading />
          ) : community.maps.length === 0 && community.yonders.length === 0 ? (
            <Empty
              title="Nothing public yet"
              body="Be the first. Finish a yonder and share it public, or publish a map for others to wander."
            />
          ) : (
            <>
              {community.maps.length > 0 && (
                <span className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">Maps to yonder near you</span>
              )}
              {community.maps.map((m) => (
                <MapCard
                  key={m.id}
                  m={m}
                  grub={a.gstate(m.id, m)}
                  duped={!!a.duped[m.id]}
                  onGrub={() => a.grub("map", m.id)}
                  onLoad={() => a.startWalk(m.destinations, m.name)}
                  onDuplicate={() => a.duplicate(m)}
                />
              ))}
              {community.yonders.length > 0 && (
                <span className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)] mt-2">Gloriously lost lately</span>
              )}
              {community.yonders.map((y) => (
                <YonderCard
                  key={y.id}
                  y={y}
                  grub={a.gstate(y.id, y)}
                  saved={!!a.saved[y.id]}
                  onGrub={() => a.grub("yonder", y.id)}
                  onSave={() => a.save(y)}
                  onLoad={() => a.startWalk(y.destinations, y.caption ?? y.area)}
                />
              ))}
            </>
          )}
        </section>
      </div>
      <AuthModal open={a.authOpen} reason={a.authReason} onClose={() => a.setAuthOpen(false)} />
    </>
  );
}
