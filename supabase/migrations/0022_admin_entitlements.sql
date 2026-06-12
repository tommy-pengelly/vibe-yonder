-- Admins can read all entitlements + grant/revoke Yonder+ (comp accounts,
-- testing). Stripe still writes via the service role; this is the manual path.
create policy "admins read all entitlements" on public.entitlements for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
create policy "admins manage entitlements" on public.entitlements for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
