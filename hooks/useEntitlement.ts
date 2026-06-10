"use client";
import { useEffect, useState } from "react";
import { useAuthUser } from "@/lib/auth";
import { type Entitlement, loadEntitlement } from "@/lib/data";

// Yonder+ entitlement for the current user. Re-reads when auth resolves.
// Use at a call site to decide whether to run a premium feature or open the
// Yonder+ sheet — the core wander never checks this (it's always free).
export function useEntitlement(): { premium: boolean; loading: boolean; ent: Entitlement | null } {
  const { user } = useAuthUser();
  const [ent, setEnt] = useState<Entitlement | null>(null);

  useEffect(() => {
    let c = false;
    setEnt(null);
    void loadEntitlement().then((e) => !c && setEnt(e));
    return () => {
      c = true;
    };
  }, [user]);

  return { premium: ent?.premium ?? false, loading: ent === null, ent };
}
