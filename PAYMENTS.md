# Yonder+ / payments setup

The app's monetisation plumbing is built and policy-agnostic. The **split lives
in `lib/plans.ts`** (which features need Yonder+, the metered allowances). Change
it there; nothing else moves.

## What's already wired
- **Entitlement read** (`useEntitlement` → `premium`), webhook-written.
- **Gating**: `useGate(feature)` / `useMeter(key)` + `PaywallProvider` (opens the
  Yonder+ sheet). One example gate is live (custom medals).
- **Meters**: `usage_counters` table + `lib/data/usage`.
- **Admin**: grant/revoke Yonder+ by @username in the Moderation view (comp
  accounts + testing).
- **Stripe code**: three edge functions — `stripe-webhook`, `create-checkout`,
  `customer-portal` — and the sheet's "Get Yonder+" calls `create-checkout`.

## Test without Stripe
- Set `NEXT_PUBLIC_PREMIUM_ALL=true` to treat everyone as Yonder+, or
- As an admin, grant yourself Plus in **Me → (admin) Moderation → Yonder+**.

## Going live (your part — needs a Stripe account)
1. **Stripe dashboard:** create a product **Yonder+** with a recurring price
   (£3/mo). Copy the **price id** (`price_…`).
2. **Supabase function secrets** (`supabase secrets set …`):
   - `STRIPE_SECRET_KEY` (sk_…)
   - `STRIPE_PRICE_ID` (price_…)
   - `STRIPE_WEBHOOK_SECRET` (whsec_…, from step 4)
   - `SITE_URL` (e.g. https://yonderful.app)
3. **Deploy the functions:**
   ```
   supabase functions deploy create-checkout
   supabase functions deploy customer-portal
   supabase functions deploy stripe-webhook --no-verify-jwt
   ```
4. **Stripe webhook:** add an endpoint pointing at the `stripe-webhook` function
   URL, for events: `checkout.session.completed`,
   `customer.subscription.updated`, `customer.subscription.deleted`. Put its
   signing secret in `STRIPE_WEBHOOK_SECRET`.
5. Test with a Stripe test card; the webhook writes the `entitlements` row and
   `useEntitlement` flips to premium.
