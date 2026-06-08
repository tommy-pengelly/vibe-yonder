"use client";
import { useEffect, useState } from "react";
import { importGuestData } from "./data";
import { getSupabase, isSupabaseConfigured } from "./supabase/client";
import type { AuthUser } from "./types";

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
      // Fold any guest data into the account once a session is present. The
      // call is module-guarded, so concurrent callers run it at most once.
      if (u) void importGuestData();
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      setUser(
        u
          ? { id: u.id, email: u.email ?? undefined }
          : null,
      );
      if (u) void importGuestData();
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
