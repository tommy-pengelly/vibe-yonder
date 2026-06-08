"use client";
import { useEffect, useState } from "react";
import { getMyProfile, importGuestData } from "./data";
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

    const apply = (u: { id: string; email?: string | null } | null) => {
      setUser(u ? { id: u.id, email: u.email ?? undefined } : null);
      if (!u) return;
      // Fold any guest data into the account (module-guarded), then hydrate the
      // social identity (username/avatar) from the profile row.
      void importGuestData();
      void getMyProfile().then((p) => {
        if (!p || cancelled) return;
        setUser((prev) =>
          prev
            ? {
                ...prev,
                username: p.username,
                displayName: p.displayName,
                avatarUrl: p.avatarUrl,
              }
            : prev,
        );
      });
    };

    sb.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      apply(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      apply(session?.user ?? null);
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
