-- Notifications: new follower / follow request / grub. Rows are inserted by
-- SECURITY DEFINER triggers (the actor can't write to the recipient's rows
-- directly), and read/updated only by the recipient.

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  type text not null check (type in ('follow', 'follow_request', 'grub')),
  actor_id uuid references auth.users on delete cascade,
  subject_type text,
  subject_id uuid,
  read boolean not null default false,
  created_at timestamptz default now()
);
alter table notifications enable row level security;
create policy "own notifications read" on notifications for select using (auth.uid() = user_id);
create policy "own notifications update" on notifications for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists notifications_user on notifications (user_id, created_at desc);

create or replace function public.notify_follow() returns trigger
  language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  insert into notifications (user_id, type, actor_id)
  values (
    new.following_id,
    case when new.status = 'pending' then 'follow_request' else 'follow' end,
    new.follower_id
  );
  return new;
end;
$$;
revoke execute on function public.notify_follow() from public, anon, authenticated;
drop trigger if exists on_follow_created on follows;
create trigger on_follow_created after insert on follows
  for each row execute function public.notify_follow();

create or replace function public.notify_grub() returns trigger
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare owner uuid;
begin
  if new.subject_type = 'yonder' then
    select user_id into owner from shared_yonders where id = new.subject_id;
  elsif new.subject_type = 'map' then
    select user_id into owner from maps where id = new.subject_id;
  end if;
  if owner is not null and owner <> new.user_id then
    insert into notifications (user_id, type, actor_id, subject_type, subject_id)
    values (owner, 'grub', new.user_id, new.subject_type, new.subject_id);
  end if;
  return new;
end;
$$;
revoke execute on function public.notify_grub() from public, anon, authenticated;
drop trigger if exists on_grub_created on grubs;
create trigger on_grub_created after insert on grubs
  for each row execute function public.notify_grub();
