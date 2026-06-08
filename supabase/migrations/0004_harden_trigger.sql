-- Vibe Yonder: harden the new-user trigger function.
-- The security advisor flags handle_new_user() for (a) a mutable search_path
-- and (b) being callable via /rest/v1/rpc by anon + authenticated. Pin the
-- search_path and revoke EXECUTE from the API roles. The AFTER INSERT trigger
-- still fires (it runs as the table owner), so sign-up profile creation is
-- unaffected.

create or replace function public.handle_new_user() returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', null))
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
