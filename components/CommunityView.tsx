"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import AuthModal from "@/components/AuthModal";
import { Empty, Loading, MapCard, YonderCard } from "@/components/feed/Cards";
import { useFeedActions } from "@/components/feed/useFeedActions";
import { PageHeader, PageScaffold, SegmentedTabs } from "@/components/ui";
import { loadCommunity, loadFollowingFeed, searchProfiles } from "@/lib/data";
import type { FeedMap, FeedYonder, Profile } from "@/lib/types";

type Outer = "discover" | "following";
type Scope = "places" | "explorers";

// The outward tab: discover public maps + yonders (and search people/places),
// or catch up on people you follow. Everything community-facing lives here.
export default function CommunityView() {
  const a = useFeedActions();
  const [outer, setOuter] = useState<Outer>("discover");

  return (
    <>
      <PageScaffold>
        <PageHeader kicker="Community" title="Find your next wander" />

        <SegmentedTabs<Outer>
          variant="underline"
          value={outer}
          onChange={setOuter}
          tabs={[
            { value: "discover", label: "Discover" },
            { value: "following", label: "Following" },
          ]}
        />

        {outer === "discover" ? <Discover a={a} /> : <Following a={a} />}
      </PageScaffold>
      <AuthModal
        open={a.authOpen}
        reason={a.authReason}
        onClose={() => a.setAuthOpen(false)}
      />
    </>
  );
}

function Discover({ a }: { a: ReturnType<typeof useFeedActions> }) {
  const [scope, setScope] = useState<Scope>("places");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"recent" | "popular">("recent");
  const [people, setPeople] = useState<Profile[]>([]);
  const [community, setCommunity] = useState<{
    yonders: FeedYonder[];
    maps: FeedMap[];
  } | null>(null);

  useEffect(() => {
    if (scope !== "explorers") return;
    let c = false;
    const term = q.trim();
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
  }, [q, scope]);

  useEffect(() => {
    if (scope !== "places") return;
    let c = false;
    setCommunity(null);
    const h = setTimeout(
      () => {
        void loadCommunity(q, sort).then((r) => {
          if (c) return;
          setCommunity(r);
          a.seedGrubs(r.yonders);
          a.seedGrubs(r.maps);
        });
      },
      q ? 350 : 0,
    );
    return () => {
      c = true;
      clearTimeout(h);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, sort, scope]);

  return (
    <div className="flex flex-col gap-4">
      <SegmentedTabs<Scope>
        variant="pill"
        value={scope}
        onChange={setScope}
        tabs={[
          { value: "places", label: "Places & maps" },
          { value: "explorers", label: "Explorers" },
        ]}
      />

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={
          scope === "explorers"
            ? "Find explorers by name or @handle…"
            : "Search the community — a place or area…"
        }
        className="w-full bg-transparent border-b border-[var(--border)] px-1 py-2.5 text-base outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]/60"
        inputMode="search"
      />

      {scope === "explorers" ? (
        <section className="flex flex-col gap-2">
          {people.length > 0 && (
            <ul className="flex flex-col divide-y divide-[var(--border)]">
              {people.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/u/${p.username}`}
                    className="flex items-center gap-3 py-2.5 hover:text-[var(--accent)]"
                  >
                    <div className="size-9 shrink-0 rounded-full bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center font-display text-xs text-[var(--warm)]">
                      {(p.displayName ?? p.username)
                        .replace(/[@.]/g, "")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-display text-sm truncate">
                        {p.displayName ?? `@${p.username}`}
                      </div>
                      <div className="text-[11px] text-[var(--muted)]">
                        @{p.username}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {q.trim().length >= 2 && people.length === 0 && (
            <p className="text-sm text-[var(--muted)] px-1">
              No explorers found.
            </p>
          )}
          {q.trim().length < 2 && (
            <p className="text-sm text-[var(--muted)] px-1">
              Search by name or @handle to follow other wanderers.
            </p>
          )}
        </section>
      ) : (
        <section className="flex flex-col gap-3.5">
          <SegmentedTabs
            variant="pill"
            value={sort}
            onChange={setSort}
            tabs={[
              { value: "recent", label: "Recent" },
              { value: "popular", label: "Popular" },
            ]}
          />

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
                <span className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
                  Maps to yonder near you
                </span>
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
                <span className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)] mt-2">
                  Gloriously lost lately
                </span>
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
      )}
    </div>
  );
}

function Following({ a }: { a: ReturnType<typeof useFeedActions> }) {
  const [feed, setFeed] = useState<FeedYonder[] | null>(null);

  useEffect(() => {
    let c = false;
    setFeed(null);
    void loadFollowingFeed().then((f) => {
      if (c) return;
      setFeed(f);
      a.seedGrubs(f);
    });
    return () => {
      c = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (feed === null) return <Loading />;
  if (feed.length === 0) {
    return (
      <Empty
        title="Quiet so far"
        body="Follow some explorers in Discover, and their wanders show up here."
      />
    );
  }
  return (
    <div className="flex flex-col gap-3.5">
      {feed.map((y) => (
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
    </div>
  );
}
