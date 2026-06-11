# Local testing (local DB + seeded data)

Run the app against a local Supabase stack with test data, so you can poke at
the social feed, missions, profiles, and follows without touching the live DB.

## One-time
- Docker running, Supabase CLI installed (`supabase --version`).

## Each session
```bash
npm run db:start     # boots local Postgres + Auth + Studio (Docker)
npm run db:reset     # applies all migrations, then runs supabase/seed.sql
npm run dev:local    # next dev pointed at the local stack (not your live DB)
```
Then open http://localhost:3000.

- `npm run dev:local` overrides `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` inline,
  so your real `.env.local` (the live project) is left untouched.
- `npm run db:stop` shuts the stack down.

## What's seeded (`supabase/seed.sql`)
Three explorers, all magic-link-able (see below):

| email | handle | display |
|---|---|---|
| alice@example.com | @alicewander | Alice Wander |
| bob@example.com | @bobrambles | Bob Rambles |
| cara@example.com | @carastrolls | Cara Strolls |

Plus: a populated **Community** feed (a wander, a straight-line mission attempt
with a medal, a public map, a ways report, a mission set), a **mission with a
two-person leaderboard**, a **public map** for Discover, **follows** (Alice
follows Bob + Cara), and some grubs. Re-run `npm run db:reset` to wipe back to
this.

## Signing in as a seed user
The app uses magic links. Locally they don't email out, they land in
**Inbucket**: http://127.0.0.1:54324. Enter e.g. `alice@example.com` in the
app's sign-in sheet, then open Inbucket and click the link in Alice's inbox.

## Handy URLs
- App: http://localhost:3000
- Studio (browse/edit tables): http://127.0.0.1:54323
- Inbucket (magic-link inbox): http://127.0.0.1:54324
