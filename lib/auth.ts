"use client";
import { useEffect, useState } from "react";
import { getSupabase, isSupabaseConfigured } from "./supabase/client";
import type { AuthUser, SavedYonder } from "./types";

export function useAuthUser(): {
  user: AuthUser | null;
  loading: boolean;
  configured: boolean;
} {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    sb.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const u = data.session?.user;
      setUser(
        u
          ? { id: u.id, email: u.email ?? undefined }
          : null,
      );
      setLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      setUser(
        u
          ? { id: u.id, email: u.email ?? undefined }
          : null,
      );
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, loading, configured: isSupabaseConfigured() };
}

export async function signInWithMagicLink(email: string) {
  const sb = getSupabase();
  if (!sb) throw new Error("Auth is not configured.");
  const redirectTo =
    typeof window !== "undefined" ? window.location.origin : undefined;
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) throw error;
}

export async function signOut() {
  const sb = getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
}

export async function persistYonder(y: SavedYonder, userId: string) {
  const sb = getSupabase();
  if (!sb) throw new Error("Auth is not configured.");
  const { error } = await sb.from("yonders").insert({
    user_id: userId,
    name: y.name,
    started_at: new Date(y.startedAt).toISOString(),
    ended_at: new Date(y.endedAt).toISOString(),
    duration_s: Math.round(y.durationMs / 1000),
    distance_m: y.walked,
    direct_m: y.direct,
    yondered: y.yondered,
    track: y.track,
  });
  if (error) throw error;
}

export async function importGuestYonders(
  yonders: SavedYonder[],
  userId: string,
) {
  if (yonders.length === 0) return;
  const sb = getSupabase();
  if (!sb) return;
  const rows = yonders.map((y) => ({
    user_id: userId,
    name: y.name,
    started_at: new Date(y.startedAt).toISOString(),
    ended_at: new Date(y.endedAt).toISOString(),
    duration_s: Math.round(y.durationMs / 1000),
    distance_m: y.walked,
    direct_m: y.direct,
    yondered: y.yondered,
    track: y.track,
  }));
  await sb.from("yonders").insert(rows);
}
