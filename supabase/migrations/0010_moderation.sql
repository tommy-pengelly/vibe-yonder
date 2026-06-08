-- Moderation: an admin flag on profiles, a resolved flag on reports, and
-- admin-only read/update of the report queue. (Reports remain INSERT-own for
-- everyone; only admins can see or resolve them.)

alter table profiles add column if not exists is_admin boolean not null default false;
alter table reports add column if not exists resolved boolean not null default false;

create policy "admins read reports" on reports for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
create policy "admins update reports" on reports for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
