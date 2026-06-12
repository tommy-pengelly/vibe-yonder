// Open the Stripe customer portal so a member can manage/cancel Yonder+.
// Deno edge function. Secrets: STRIPE_SECRET_KEY, SITE_URL (+ the auto-injected
// SUPABASE_URL / SUPABASE_ANON_KEY). Deploy: supabase functions deploy customer-portal
//
// Reads the caller's stripe_customer_id from their own entitlement row.

import Stripe from "https://esm.sh/stripe@16?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
});
const SITE = Deno.env.get("SITE_URL") ?? "http://localhost:3000";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const sb = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
  );
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401, headers: cors });

  const { data: ent } = await sb
    .from("entitlements")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const customer = (ent as { stripe_customer_id?: string } | null)?.stripe_customer_id;
  if (!customer) return new Response("No subscription", { status: 404, headers: cors });

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer,
      return_url: `${SITE}/you`,
    });
    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
