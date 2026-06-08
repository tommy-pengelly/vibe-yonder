-- Private accounts: a private user's shared yonders (even 'public' ones) are
-- only visible to their accepted followers. Re-derive the shared_yonders read
-- policies to factor in the author's profiles.is_private.

drop policy if exists "public shared yonders readable" on shared_yonders;
drop policy if exists "followers shared yonders readable" on shared_yonders;

-- Public yonders of NON-private accounts are world-readable.
create policy "public shared yonders readable" on shared_yonders for select
  using (
    visibility = 'public'
    and not exists (
      select 1 from profiles p where p.id = shared_yonders.user_id and p.is_private
    )
  );

-- Accepted followers see a user's public + followers yonders (covers private
-- accounts entirely, and the followers-only visibility of public accounts).
create policy "follower shared yonders readable" on shared_yonders for select
  using (
    visibility in ('public', 'followers')
    and exists (
      select 1 from follows f
      where f.following_id = shared_yonders.user_id
        and f.follower_id = auth.uid()
        and f.status = 'accepted'
    )
  );
