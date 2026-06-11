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
Sign-in emails carry a **6-digit code** (and a magic link). Locally they don't
send out, they land in the mail viewer (Mailpit, which the CLI labels
"Inbucket"): http://127.0.0.1:54324.

1. Enter e.g. `alice@example.com` in the app's sign-in sheet, tap "Email me a
   code".
2. Open the mail viewer, copy the 6-digit code from Alice's email.
3. Type it into the app. (No link click / redirect needed, so the dev port
   doesn't matter.)

## Handy URLs
- App: http://localhost:3000 (or :3001 - the code flow doesn't care)
- Studio (browse/edit tables): http://127.0.0.1:54323
- Mail viewer (the sign-in codes): http://127.0.0.1:54324

> Prod note: the code only shows because of `supabase/templates/magic_link.html`
> (`{{ .Token }}`). Mirror it in the dashboard: Auth > Email Templates > Magic
> Link, include `{{ .Token }}`.
