-- Live, admin-editable plan config: which features need Yonder+, and the free
-- meter limits. Public-readable (every client checks gates); admin-writable.
-- Rows override lib/plans.ts defaults; a missing row falls back to the default.
create table if not exists public.feature_gates (
  feature text primary key,
  requires_plus boolean not null default true,
  updated_at timestamptz not null default now()
);
create table if not exists public.meter_limits (
  meter text primary key,
  free_limit int not null,
  period text not null default 'month',
  updated_at timestamptz not null default now()
);
alter table public.feature_gates enable row level security;
alter table public.meter_limits enable row level security;
create policy "feature gates public read" on public.feature_gates for select using (true);
create policy "meter limits public read" on public.meter_limits for select using (true);
create policy "admins write feature gates" on public.feature_gates for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
create policy "admins write meter limits" on public.meter_limits for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
