// Create a Stripe Checkout session for Yonder+. Deno edge function (Supabase).
// NOT live until you set the secrets and deploy:
//   STRIPE_SECRET_KEY, STRIPE_PRICE_ID  (the Yonder+ recurring price),
//   SITE_URL  (e.g. https://yonderful.app),
//   SUPABASE_URL, SUPABASE_ANON_KEY  (auto-injected by Supabase)
//
// Deploy:  supabase functions deploy create-checkout
// The caller's JWT identifies the user; user_id is put in the session +
// subscription metadata so the stripe-webhook can write their entitlement.

import Stripe from "https://esm.sh/stripe@16?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
});
const PRICE = Deno.env.get("STRIPE_PRICE_ID") ?? "";
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

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: PRICE, quantity: 1 }],
      subscription_data: { trial_period_days: 7, metadata: { user_id: user.id } },
      metadata: { user_id: user.id },
      customer_email: user.email ?? undefined,
      success_url: `${SITE}/you?plus=welcome`,
      cancel_url: `${SITE}/you`,
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
