"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuthUser } from "@/lib/auth";
import { duplicateMap, saveYonderPlaces, setGrub } from "@/lib/data";
import type { FeedMap, FeedYonder, Target } from "@/lib/types";

type GrubMap = Record<string, { count: number; active: boolean }>;

/** Social interactions shared by the Following + Community feeds: grub, save,
 * duplicate, "Yonder this", and the sign-in gate. Optimistic local state. */
export function useFeedActions() {
  const router = useRouter();
  const { user } = useAuthUser();
  const [grubs, setGrubs] = useState<GrubMap>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [duped, setDuped] = useState<Record<string, boolean>>({});
  const [authOpen, setAuthOpen] = useState(false);
  const [authReason, setAuthReason] = useState<string | undefined>();

  const requireAuth = (reason: string) => {
    if (user) return true;
    setAuthReason(reason);
    setAuthOpen(true);
    return false;
  };

  const seedGrubs = (items: { id: string; grubs: number; grubbed: boolean }[]) =>
    setGrubs((g) => {
      const next = { ...g };
      for (const it of items) if (!(it.id in next)) next[it.id] = { count: it.grubs, active: it.grubbed };
      return next;
    });

  const gstate = (id: string, fallback: { grubs: number; grubbed: boolean }) =>
    grubs[id] ?? { count: fallback.grubs, active: fallback.grubbed };

  const grub = (subject: "yonder" | "map" | "post", id: string) => {
    if (!requireAuth("Sign in to grub a yonder you loved.")) return;
    setGrubs((g) => {
      const cur = g[id] ?? { count: 0, active: false };
      const active = !cur.active;
      void setGrub(subject, id, active);
      return { ...g, [id]: { count: cur.count + (active ? 1 : -1), active } };
    });
  };

  const save = (y: FeedYonder) => {
    if (!requireAuth("Sign in to keep this for later.")) return;
    if (saved[y.id]) return;
    setSaved((s) => ({ ...s, [y.id]: true }));
    void saveYonderPlaces(y.caption ?? y.area, y.destinations);
  };

  const startWalk = (
    dests: { name: string; label?: string; lat: number; lon: number }[],
    name: string,
    mapId?: string,
  ) => {
    if (typeof window === "undefined" || dests.length === 0) return;
    const targets: Target[] = dests.map((d) => ({
      id: crypto.randomUUID(),
      name: d.name,
      label: d.label,
      lat: d.lat,
      lon: d.lon,
      visited: false,
    }));
    // Link to the source map (e.g. a community map you loaded), so your ways
    // show on it and it can be counted — your traces stay private to you.
    window.sessionStorage.setItem(
      "vibe-yonder.start",
      JSON.stringify({
        mode: targets.length > 1 ? "collection" : "single",
        targets,
        name,
        mapId,
      }),
    );
    router.push("/walk");
  };

  const duplicate = (m: FeedMap) => {
    if (!requireAuth("Sign in to duplicate this into your maps.")) return;
    if (duped[m.id]) return;
    setDuped((d) => ({ ...d, [m.id]: true }));
    void duplicateMap(m.mapId ?? m.id);
  };

  return {
    user,
    saved,
    duped,
    authOpen,
    authReason,
    setAuthOpen,
    requireAuth,
    seedGrubs,
    gstate,
    grub,
    save,
    startWalk,
    duplicate,
  };
}
