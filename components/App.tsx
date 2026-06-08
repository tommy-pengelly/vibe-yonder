"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useHeading } from "@/hooks/useHeading";
import { useSettings } from "@/lib/settings";
import {
  importGuestYonders,
  persistYonder,
  signOut,
  useAuthUser,
} from "@/lib/auth";
import { haversine } from "@/lib/geo";
import { summarize } from "@/lib/stats";
import {
  clearDraftList,
  clearYonders,
  deleteList,
  loadDraftList,
  loadFavourites,
  loadLists,
  loadYonders,
  newList,
  pushYonder,
  saveDraftList,
  saveList,
} from "@/lib/storage";
import type {
  Destination,
  FavouritePlace,
  Fix,
  ListItemState,
  ListJourney,
  SavedYonder,
  StoredList,
} from "@/lib/types";
import { keepAwake } from "@/lib/wake";
import AuthModal from "./AuthModal";
import Landing from "./Landing";
import ListBuilder from "./ListBuilder";
import ListView from "./ListView";
import Recap from "./Recap";
import SearchScreen from "./SearchScreen";
import WalkScreen from "./WalkScreen";

type Phase =
  | "landing"
  | "search"
  | "list-builder"
  | "list-view"
  | "walking"
  | "recap";

const MIN_FIX_DISTANCE_M = 3;
const MIN_FIX_INTERVAL_MS = 3000;
const DEFAULT_MPP = 0.6;
const TRIVIAL_WALK_M = 30;

export default function App() {
  const [phase, setPhase] = useState<Phase>("landing");
  const [destination, setDestination] = useState<Destination | null>(null);
  const [journey, setJourney] = useState<ListJourney | null>(null);
  const [openList, setOpenList] = useState<StoredList | null>(null);

  const [track, setTrack] = useState<Fix[]>([]);
  const [paused, setPaused] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [pausedMs, setPausedMs] = useState(0);
  const mpp = DEFAULT_MPP;

  const [savedYonder, setSavedYonder] = useState<SavedYonder | null>(null);

  const [favourites, setFavourites] = useState<FavouritePlace[]>([]);
  const [lists, setLists] = useState<StoredList[]>([]);
  const [recent, setRecent] = useState<SavedYonder[]>([]);
  const [draftItems, setDraftItems] = useState<ListItemState[]>([]);

  const [authOpen, setAuthOpen] = useState(false);
  const [authReason, setAuthReason] = useState<string | undefined>(undefined);
  const [savedToCloud, setSavedToCloud] = useState(false);

  const lastFix = useRef<Fix | null>(null);
  const pausedAt = useRef<number | null>(null);
  const { heading, requestAccess } = useHeading();
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const { settings, update: updateSettings } = useSettings();

  const { user, configured: authConfigured } = useAuthUser();

  useEffect(() => {
    setFavourites(loadFavourites());
    setLists(loadLists());
    setRecent(loadYonders());
    setDraftItems(loadDraftList());
  }, []);

  // Import guest yonders the first time we see a signed-in user.
  const importedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!user || importedFor.current === user.id) return;
    importedFor.current = user.id;
    const guestRecent = loadYonders();
    if (guestRecent.length === 0) return;
    void importGuestYonders(guestRecent, user.id)
      .then(() => clearYonders())
      .then(() => setRecent([]))
      .catch(() => {
        // leave guest state alone if upload fails
      });
  }, [user]);

  const handleFix = useCallback((f: Fix) => {
    if (pausedRef.current) return;
    const prev = lastFix.current;
    if (
      !prev ||
      haversine(prev.lat, prev.lon, f.lat, f.lon) > MIN_FIX_DISTANCE_M ||
      f.t - prev.t > MIN_FIX_INTERVAL_MS
    ) {
      lastFix.current = f;
      setTrack((t) => [...t, f]);
    }
  }, []);

  const { fix, error } = useGeolocation(
    phase !== "landing",
    phase === "walking" ? handleFix : undefined,
  );

  useEffect(() => {
    if (phase !== "walking") return;
    void keepAwake(!paused);
    const onVis = () => {
      if (document.visibilityState === "visible" && !paused) {
        void keepAwake(true);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      void keepAwake(false);
    };
  }, [phase, paused]);

  const autoName = useCallback((d: Destination | null) => {
    if (!d) return "Wander";
    const piece = d.name.split(",")[0].trim();
    return piece || "Wander";
  }, []);

  const beginWalk = useCallback(
    async (d: Destination, opts: { journey: ListJourney | null }) => {
      await requestAccess();
      setDestination(d);
      setJourney(opts.journey);
      setTrack([]);
      lastFix.current = null;
      pausedAt.current = null;
      setPausedMs(0);
      setPaused(false);
      setStartTime(Date.now());
      setEndTime(null);
      setSavedYonder(null);
      setSavedToCloud(false);
      setPhase("walking");
    },
    [requestAccess],
  );

  const flushPausedAt = useCallback(() => {
    if (pausedAt.current != null) {
      const delta = Date.now() - pausedAt.current;
      pausedAt.current = null;
      setPausedMs((ms) => ms + delta);
    }
  }, []);

  const pause = useCallback(() => {
    pausedAt.current = Date.now();
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    flushPausedAt();
    setPaused(false);
  }, [flushPausedAt]);

  const goLanding = useCallback(() => {
    setPhase("landing");
    setDestination(null);
    setJourney(null);
    setOpenList(null);
    setTrack([]);
    lastFix.current = null;
    pausedAt.current = null;
    setStartTime(null);
    setEndTime(null);
    setPausedMs(0);
    setPaused(false);
    setSavedYonder(null);
    setSavedToCloud(false);
    setRecent(loadYonders());
  }, []);

  const discard = useCallback(() => {
    void keepAwake(false);
    goLanding();
  }, [goLanding]);

  const finish = useCallback(() => {
    flushPausedAt();
    const now = Date.now();
    setEndTime(now);
    setPaused(false);

    const summary = summarize(track, startTime, pausedMs, now);

    if (summary.walked < TRIVIAL_WALK_M) {
      // trivial walk — don't save a recap, just return
      void keepAwake(false);
      goLanding();
      return;
    }

    const y: SavedYonder = {
      id: crypto.randomUUID(),
      name: autoName(destination),
      startedAt: startTime ?? now,
      endedAt: now,
      durationMs: summary.durationMs,
      walked: summary.walked,
      direct: summary.direct,
      yondered: summary.yondered,
      track,
      pausedMs,
      destination: destination!,
    };

    pushYonder(y);
    setRecent(loadYonders());
    setSavedYonder(y);

    if (journey) {
      const updated: StoredList = {
        ...journey.list,
        items: journey.list.items.map((it, idx) =>
          idx === journey.activeIndex
            ? { ...it, visited: true, visitedAt: now }
            : it,
        ),
        updatedAt: now,
      };
      saveList(updated);
      setLists(loadLists());
    }

    void keepAwake(false);
    setPhase("recap");
  }, [
    autoName,
    destination,
    flushPausedAt,
    goLanding,
    journey,
    pausedMs,
    startTime,
    track,
  ]);

  const advanceJourney = useCallback(() => {
    if (!journey) return;
    flushPausedAt();
    const now = Date.now();
    const updatedList: StoredList = {
      ...journey.list,
      items: journey.list.items.map((it, idx) =>
        idx === journey.activeIndex
          ? { ...it, visited: true, visitedAt: now }
          : it,
      ),
      updatedAt: now,
    };
    saveList(updatedList);
    setLists(loadLists());

    const nextIndex = journey.activeIndex + 1;
    if (nextIndex >= updatedList.items.length) {
      finish();
      return;
    }
    const nextItem = updatedList.items[nextIndex];
    setJourney({ list: updatedList, activeIndex: nextIndex });
    setDestination({
      name: nextItem.name,
      label: nextItem.label,
      lat: nextItem.lat,
      lon: nextItem.lon,
    });
  }, [finish, flushPausedAt, journey]);

  const renameRecap = useCallback((name: string) => {
    setSavedYonder((y) => {
      if (!y) return y;
      const next = { ...y, name };
      const all = loadYonders();
      const updated = all.map((x) => (x.id === y.id ? next : x));
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(
            "vibe-yonder.yonders.v1",
            JSON.stringify(updated),
          );
        }
      } catch {}
      setRecent(updated);
      return next;
    });
  }, []);

  const saveRecapToCloud = useCallback(() => {
    if (!savedYonder) return;
    if (!user) {
      setAuthReason("Sign in to keep your yonders on your account.");
      setAuthOpen(true);
      return;
    }
    void persistYonder(savedYonder, user.id)
      .then(() => setSavedToCloud(true))
      .catch(() => {
        setAuthReason("Save failed. Sign in again?");
        setAuthOpen(true);
      });
  }, [savedYonder, user]);

  const draftToList = useCallback(
    (item: Omit<ListItemState, "id" | "visited">) => {
      setDraftItems((items) => {
        const next: ListItemState[] = [
          ...items,
          { ...item, id: crypto.randomUUID(), visited: false },
        ];
        saveDraftList(next);
        return next;
      });
    },
    [],
  );

  const removeDraftItem = useCallback((id: string) => {
    setDraftItems((items) => {
      const next = items.filter((i) => i.id !== id);
      saveDraftList(next);
      return next;
    });
  }, []);

  const moveDraftItem = useCallback((id: string, dir: -1 | 1) => {
    setDraftItems((items) => {
      const idx = items.findIndex((i) => i.id === id);
      if (idx < 0) return items;
      const target = idx + dir;
      if (target < 0 || target >= items.length) return items;
      const next = [...items];
      [next[idx], next[target]] = [next[target], next[idx]];
      saveDraftList(next);
      return next;
    });
  }, []);

  const commitNewList = useCallback(
    (name: string) => {
      const list = newList(name, draftItems);
      saveList(list);
      setLists(loadLists());
      setDraftItems([]);
      clearDraftList();
      setOpenList(list);
      setPhase("list-view");
    },
    [draftItems],
  );

  const startList = useCallback(
    (list: StoredList) => {
      const firstUnvisitedIdx = list.items.findIndex((i) => !i.visited);
      const idx = firstUnvisitedIdx >= 0 ? firstUnvisitedIdx : 0;
      const item = list.items[idx];
      if (!item) return;
      void beginWalk(
        {
          name: item.name,
          label: item.label,
          lat: item.lat,
          lon: item.lon,
        },
        { journey: { list, activeIndex: idx } },
      );
    },
    [beginWalk],
  );

  const markVisited = useCallback(
    (itemId: string, visited: boolean) => {
      if (!openList) return;
      const updated: StoredList = {
        ...openList,
        items: openList.items.map((it) =>
          it.id === itemId
            ? { ...it, visited, visitedAt: visited ? Date.now() : undefined }
            : it,
        ),
        updatedAt: Date.now(),
      };
      saveList(updated);
      setLists(loadLists());
      setOpenList(updated);
    },
    [openList],
  );

  const editOpenList = useCallback(() => {
    if (!openList) return;
    setDraftItems(openList.items);
    saveDraftList(openList.items);
    setPhase("list-builder");
  }, [openList]);

  const deleteOpenList = useCallback(() => {
    if (!openList) return;
    deleteList(openList.id);
    setLists(loadLists());
    setOpenList(null);
    setPhase("search");
  }, [openList]);

  const saveStatus = useMemo(() => {
    if (!authConfigured) return "Save locally";
    if (savedToCloud) return "Saved ✓";
    return user ? "Save to account" : "Save to account";
  }, [authConfigured, savedToCloud, user]);

  if (phase === "landing") {
    return (
      <>
        <Landing
          user={user}
          recent={recent}
          onStart={() => setPhase("search")}
          onSignIn={() => {
            setAuthReason(undefined);
            setAuthOpen(true);
          }}
          onSignOut={() => void signOut()}
          onOpenRecap={(y) => {
            setSavedYonder(y);
            setDestination(y.destination);
            setStartTime(y.startedAt);
            setEndTime(y.endedAt);
            setTrack(y.track);
            setPausedMs(y.pausedMs);
            setSavedToCloud(false);
            setPhase("recap");
          }}
        />
        <AuthModal
          open={authOpen}
          reason={authReason}
          onClose={() => setAuthOpen(false)}
        />
      </>
    );
  }

  if (phase === "search") {
    return (
      <>
        <SearchScreen
          position={fix}
          favourites={favourites}
          lists={lists}
          recent={recent}
          onPick={(d) => void beginWalk(d, { journey: null })}
          onAddToDraftList={(d) => {
            draftToList({ name: d.name, label: d.label, lat: d.lat, lon: d.lon });
            setPhase("list-builder");
          }}
          onOpenList={(l) => {
            setOpenList(l);
            setPhase("list-view");
          }}
          onOpenListBuilder={() => setPhase("list-builder")}
          onOpenRecap={(y) => {
            setSavedYonder(y);
            setDestination(y.destination);
            setStartTime(y.startedAt);
            setEndTime(y.endedAt);
            setTrack(y.track);
            setPausedMs(y.pausedMs);
            setSavedToCloud(false);
            setPhase("recap");
          }}
          onBack={() => setPhase("landing")}
        />
        <AuthModal
          open={authOpen}
          reason={authReason}
          onClose={() => setAuthOpen(false)}
        />
      </>
    );
  }

  if (phase === "list-builder") {
    return (
      <ListBuilder
        items={draftItems}
        initialName={openList?.name}
        position={fix}
        onAdd={(item) => draftToList(item)}
        onRemove={removeDraftItem}
        onMove={moveDraftItem}
        onSave={commitNewList}
        onCancel={() => {
          setDraftItems([]);
          clearDraftList();
          setPhase("search");
        }}
      />
    );
  }

  if (phase === "list-view" && openList) {
    return (
      <ListView
        list={openList}
        onStart={() => startList(openList)}
        onEdit={editOpenList}
        onDelete={deleteOpenList}
        onMarkVisited={markVisited}
        onBack={() => setPhase("search")}
      />
    );
  }

  if (phase === "walking" && destination) {
    return (
      <WalkScreen
        destination={destination}
        journey={journey}
        position={fix}
        heading={heading}
        track={track}
        startTime={startTime}
        pausedMs={pausedMs}
        paused={paused}
        geoError={error}
        mpp={mpp}
        hideNumbers={settings.hideNumbers}
        onToggleHideNumbers={() =>
          updateSettings({ hideNumbers: !settings.hideNumbers })
        }
        onPause={pause}
        onResume={resume}
        onFinish={finish}
        onDiscard={discard}
        onAdvanceJourney={advanceJourney}
        onCalibrate={() => void requestAccess()}
      />
    );
  }

  if (phase === "recap" && savedYonder) {
    return (
      <>
        <Recap
          saved={savedYonder}
          onRenameTitle={renameRecap}
          onNewWalk={() => setPhase("search")}
          onSave={saveRecapToCloud}
          saveLabel={saveStatus}
          saveDisabled={savedToCloud}
        />
        <AuthModal
          open={authOpen}
          reason={authReason}
          onClose={() => setAuthOpen(false)}
        />
      </>
    );
  }

  // misc unused refs to suppress noise from end times that are read elsewhere
  void endTime;

  return null;
}
