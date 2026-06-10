-- Entitlements: a per-user subscription state for "Yonder+". The core wander
-- stays free + guest forever (CLAUDE.md); this only gates *extras*.
--
-- Rows are written by the Stripe webhook (service role, bypasses RLS) on
-- checkout/subscription events. Users can only READ their own row. A user with
-- no row is simply free.

create table if not exists public.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null default 'free' check (tier in ('free', 'plus')),
  status text not null default 'inactive'
    check (status in ('inactive', 'active', 'trialing', 'past_due', 'canceled')),
  current_period_end timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  updated_at timestamptz not null default now()
);

alter table public.entitlements enable row level security;

create policy "own entitlement readable" on public.entitlements
  for select using (auth.uid() = user_id);
-- No user insert/update/delete: only the webhook (service role) writes.
