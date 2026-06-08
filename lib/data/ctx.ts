"use client";
// Shared dual-mode helper. Every data op calls ctx(): when there's a signed-in
// Supabase session it returns the cloud client + uid; otherwise null and the
// caller falls back to the synchronous localStorage layer (../storage) or, for
// auth-only social ops, no-ops.
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "../supabase/client";

export type Ctx = { sb: SupabaseClient; uid: string };

export async function ctx(): Promise<Ctx | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  const uid = data.session?.user?.id;
  return uid ? { sb, uid } : null;
}
