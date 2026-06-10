// Stripe webhook → entitlements. Deno edge function (Supabase). NOT deployed
// yet — it needs secrets set on the project:
//   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected by Supabase)
//
// Deploy:  supabase functions deploy stripe-webhook --no-verify-jwt
// Then add the function URL as a Stripe webhook endpoint for events:
//   checkout.session.completed, customer.subscription.{updated,deleted}
//
// It writes the user's entitlements row with the service role (bypasses RLS).
// The Stripe customer/subscription must carry the Supabase user id in
// metadata.user_id (set it when you create the Checkout session).

import Stripe from "https://esm.sh/stripe@16?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
});
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

async function upsertEntitlement(row: {
  user_id: string;
  tier: "free" | "plus";
  status: string;
  current_period_end: number | null;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
}) {
  await admin.from("entitlements").upsert(
    {
      ...row,
      current_period_end: row.current_period_end
        ? new Date(row.current_period_end * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
}

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig ?? "", webhookSecret);
  } catch (err) {
    return new Response(`Bad signature: ${(err as Error).message}`, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const s = event.data.object as Stripe.Checkout.Session;
      const userId = s.metadata?.user_id;
      if (userId && s.subscription) {
        const sub = await stripe.subscriptions.retrieve(s.subscription as string);
        await upsertEntitlement({
          user_id: userId,
          tier: "plus",
          status: sub.status,
          current_period_end: sub.current_period_end,
          stripe_customer_id: s.customer as string,
          stripe_subscription_id: sub.id,
        });
      }
    } else if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.user_id;
      const canceled = event.type === "customer.subscription.deleted";
      if (userId) {
        await upsertEntitlement({
          user_id: userId,
          tier: canceled ? "free" : "plus",
          status: canceled ? "canceled" : sub.status,
          current_period_end: sub.current_period_end,
          stripe_subscription_id: sub.id,
        });
      }
    }
  } catch (err) {
    return new Response(`Handler error: ${(err as Error).message}`, { status: 500 });
  }
  return new Response("ok", { status: 200 });
});
