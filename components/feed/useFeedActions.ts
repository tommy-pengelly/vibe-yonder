"use client";
import { useState } from "react";
import { useAuthUser } from "@/lib/auth";
import { saveYonderPlaces, setGrub } from "@/lib/data";
import type { Destination } from "@/lib/types";

type GrubMap = Record<string, { count: number; active: boolean }>;

/** Social interactions shared by the Following + Community feeds: grub, save,
 * and the sign-in gate. The primary actions (Yonder this / Attempt) live on the
 * detail pages the cards open. Optimistic local state. */
export function useFeedActions() {
  const { user } = useAuthUser();
  const [grubs, setGrubs] = useState<GrubMap>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
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

  const save = (item: { id: string; name: string; destinations: Destination[] }) => {
    if (!requireAuth("Sign in to keep this for later.")) return;
    if (saved[item.id]) return;
    setSaved((s) => ({ ...s, [item.id]: true }));
    void saveYonderPlaces(item.name, item.destinations);
  };

  return {
    user,
    saved,
    authOpen,
    authReason,
    setAuthOpen,
    requireAuth,
    seedGrubs,
    gstate,
    grub,
    save,
  };
}
