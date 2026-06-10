"use client";
import { Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import AuthModal from "@/components/AuthModal";
import { Empty, Loading, MapCard, WaysCard, YonderCard } from "@/components/feed/Cards";
import { useFeedActions } from "@/components/feed/useFeedActions";
import {
  BottomSheet,
  PageHeader,
  PageScaffold,
  SegmentedTabs,
} from "@/components/ui";
import { loadCommunity, loadFeed, searchProfiles } from "@/lib/data";
import type { FeedItem, FeedMap, FeedYonder, Profile } from "@/lib/types";

type Tab = "following" | "everyone" | "discover";

// The outward tab. A search button in the header opens a search sheet; below,
// three tabs: Following (your people's wanders, the default feed), Everyone
// (the whole community), and Discover (maps to wander).
export default function CommunityView() {
  const a = useFeedActions();
  const [tab, setTab] = useState<Tab>("following");
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      <PageScaffold>
        <PageHeader
          kicker="Community"
          title="Where others wandered"
          action={
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search the community"
              className="size-9 rounded-full border border-[var(--border)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--accent)] hover:border-[var(--accent)]"
            >
              <Search className="w-4 h-4" strokeWidth={1.75} />
            </button>
          }
        />

        <SegmentedTabs<Tab>
          variant="underline"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "following", label: "Following" },
            { value: "everyone", label: "Everyone" },
            { value: "discover", label: "Discover" },
          ]}
        />

        {tab === "discover" ? (
          <DiscoverTab a={a} />
        ) : (
          <FeedTab a={a} scope={tab} onBrowseEveryone={() => setTab("everyone")} />
        )}
      </PageScaffold>

      <SearchSheet
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        a={a}
      />

      <AuthModal
        open={a.authOpen}
        reason={a.authReason}
        onClose={() => a.setAuthOpen(false)}
      />
    </>
  );
}

// ----- Feed: completed yonders (Following / Everyone, set by the top tab) -----
function FeedTab({
  a,
  scope,
  onBrowseEveryone,
}: {
  a: ReturnType<typeof useFeedActions>;
  scope: "following" | "everyone";
  onBrowseEveryone: () => void;
}) {
  const [items, setItems] = useState<FeedItem[] | null>(null);

  useEffect(() => {
    let c = false;
    setItems(null);
    void loadFeed(scope === "following" ? "following" : "community").then((it) => {
      if (c) return;
      setItems(it);
      // seed grub state for grubbable items
      a.seedGrubs(
        it
          .filter((i) => i.kind === "yonder" || i.kind === "map")
          .map((i) =>
            i.kind === "yonder"
              ? { id: i.id, grubs: i.y.grubs, grubbed: i.y.grubbed }
              : { id: i.id, grubs: i.m.grubs, grubbed: i.m.grubbed },
          ),
      );
    });
    return () => {
      c = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  return (
    <div className="flex flex-col gap-3.5">
      {items === null ? (
        <Loading />
      ) : items.length === 0 ? (
        scope === "following" ? (
          <Empty
            title="Quiet so far"
            body="Follow some explorers and their wanders show up here. Meanwhile, see where everyone's been."
            cta={{ label: "Browse everyone", onClick: onBrowseEveryone }}
          />
        ) : (
          <Empty
            title="Nothing public yet"
            body="Be the first, finish a yonder, publish a map, or post a ways report."
          />
        )
      ) : (
        items.map((it) => <FeedItemCard key={it.id} item={it} a={a} />)
      )}
    </div>
  );
}

// One feed, every kind of post, render the right card.
function FeedItemCard({
  item,
  a,
}: {
  item: FeedItem;
  a: ReturnType<typeof useFeedActions>;
}) {
  if (item.kind === "ways") return <WaysCard w={item.w} />;
  if (item.kind === "map") {
    const m = item.m;
    return (
      <MapCard
        m={m}
        grub={a.gstate(m.id, m)}
        duped={!!a.duped[m.id]}
        onGrub={() => a.grub("post", m.id)}
        onLoad={() => a.startWalk(m.destinations, m.name, m.mapId)}
        onDuplicate={() => a.duplicate(m)}
      />
    );
  }
  const y = item.y;
  return (
    <YonderCard
      y={y}
      grub={a.gstate(y.id, y)}
      saved={!!a.saved[y.id]}
      onGrub={() => a.grub("post", y.id)}
      onSave={() => a.save(y)}
      onLoad={() => a.startWalk(y.destinations, y.caption ?? y.area)}
    />
  );
}

// ----- Discover: maps to wander -----
function DiscoverTab({ a }: { a: ReturnType<typeof useFeedActions> }) {
  const [sort, setSort] = useState<"recent" | "popular">("recent");
  const [maps, setMaps] = useState<FeedMap[] | null>(null);

  useEffect(() => {
    let c = false;
    setMaps(null);
    void loadCommunity("", sort).then((r) => {
      if (c) return;
      setMaps(r.maps);
      a.seedGrubs(r.maps);
    });
    return () => {
      c = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  return (
    <div className="flex flex-col gap-3.5">
      <SegmentedTabs
        variant="pill"
        value={sort}
        onChange={setSort}
        tabs={[
          { value: "recent", label: "Recent" },
          { value: "popular", label: "Popular" },
        ]}
      />
      {maps === null ? (
        <Loading />
      ) : maps.length === 0 ? (
        <Empty
          title="No maps yet"
          body="Publish a map of places, and it shows up here for others to wander."
        />
      ) : (
        maps.map((m) => (
          <MapCard
            key={m.id}
            m={m}
            grub={a.gstate(m.id, m)}
            duped={!!a.duped[m.id]}
            onGrub={() => a.grub("map", m.id)}
            onLoad={() => a.startWalk(m.destinations, m.name, m.id)}
            onDuplicate={() => a.duplicate(m)}
          />
        ))
      )}
    </div>
  );
}

// ----- Search sheet: places & maps, or explorers -----
function SearchSheet({
  open,
  onClose,
  a,
}: {
  open: boolean;
  onClose: () => void;
  a: ReturnType<typeof useFeedActions>;
}) {
  const [scope, setScope] = useState<"places" | "explorers">("places");
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<Profile[]>([]);
  const [results, setResults] = useState<{
    yonders: FeedYonder[];
    maps: FeedMap[];
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    let c = false;
    if (scope === "explorers") {
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
    }
    if (term.length < 2) {
      setResults(null);
      return;
    }
    const h = setTimeout(() => {
      void loadCommunity(term, "recent").then((r) => {
        if (c) return;
        setResults(r);
        a.seedGrubs(r.yonders);
        a.seedGrubs(r.maps);
      });
    }, 350);
    return () => {
      c = true;
      clearTimeout(h);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, scope, open]);

  return (
    <BottomSheet open={open} onClose={onClose} title="Search the community" minHeightVh={70}>
      <SegmentedTabs
        variant="pill"
        value={scope}
        onChange={(s) => {
          setScope(s);
          setQ("");
        }}
        tabs={[
          { value: "places", label: "Places & maps" },
          { value: "explorers", label: "Explorers" },
        ]}
      />
      <div className="flex items-center gap-2 border-b border-[var(--border)] focus-within:border-[var(--accent)]">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={
            scope === "explorers"
              ? "Name or @handle…"
              : "A place or area…"
          }
          className="flex-1 bg-transparent px-1 py-2.5 text-base outline-none placeholder:text-[var(--muted)]/60"
          inputMode="search"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label="Clear"
            className="text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        )}
      </div>

      {scope === "explorers" ? (
        <ul className="flex flex-col divide-y divide-[var(--border)]">
          {people.map((p) => (
            <li key={p.id}>
              <Link
                href={`/u/${p.username}`}
                onClick={onClose}
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
          {q.trim().length >= 2 && people.length === 0 && (
            <li className="text-sm text-[var(--muted)] py-2">
              No explorers found.
            </li>
          )}
        </ul>
      ) : (
        <div className="flex flex-col gap-3">
          {results?.maps.map((m) => (
            <MapCard
              key={m.id}
              m={m}
              grub={a.gstate(m.id, m)}
              duped={!!a.duped[m.id]}
              onGrub={() => a.grub("map", m.id)}
              onLoad={() => a.startWalk(m.destinations, m.name, m.id)}
              onDuplicate={() => a.duplicate(m)}
            />
          ))}
          {results?.yonders.map((y) => (
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
          {results &&
            results.maps.length === 0 &&
            results.yonders.length === 0 && (
              <p className="text-sm text-[var(--muted)] py-2">
                Nothing matches yet.
              </p>
            )}
        </div>
      )}
    </BottomSheet>
  );
}
