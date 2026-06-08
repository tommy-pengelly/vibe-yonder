# Vibe Yonder — Doc 3: Community & Social

**The multiplayer layer.** Builds on Docs 1–2 by letting people share yonders, discover others', and connect. Community (sharing/discovery) and social (profiles/feeds/connections) are one backend, so they're one doc.

Two rules that keep it on-brand (from CLAUDE.md): **you share places, not routes** — adopting someone's yonder means taking their *destinations* and wandering your own way, never retracing their path — and **no competition** (no pace, no speed leaderboards; recognition is for exploring).

Doc series: 1. Solo MVP · 2. Account & History · **3. Community & Social** ← here.

---

## What "sharing a yonder" means

A shared yonder carries its **destination(s)** + an **obfuscated trace** (a memento, not a path to follow) + stats (Yondered, distance, time) + optional caption. Other people can:
- **Load it** — adopt the destination(s) and start their *own* yonder there (wander their own way).
- **Save it** — bookmark to do later.
- **Duplicate it** — copy the destination(s)/list into their own lists to edit and make their own.

(Public lists are **collections** — same mechanics: load / save / duplicate.)

---

## Privacy & moderation (the foundation, build first)

A social *walking* app broadcasts where people physically go. This is not optional polish.

- **Default visibility = private.** Sharing is an explicit, per-yonder choice (`private` / `followers` / `public`).
- **Privacy zones + obfuscation.** The user sets a home (or any) area; any shared trace **hides a radius around it** and **trims start/end ~150–200 m**. The precise trace is **owner-only**; sharing uses an obfuscated copy.
- **No live location sharing.** No "see friends walking now."
- **Block & report** on profiles, yonders, collections; a basic **moderation queue** for reported public content.

*Done when:* nothing is public by default; every shared trace is obfuscated and respects privacy zones; users can block/report; the precise track is never exposed to anyone but its owner.

---

## Social graph

- **Asymmetric follow** (Strava-style): you follow people; no reciprocation required.
- **Public profiles by default**; optional **private profile** (follow requires approval — can ship public-only first).
- A **profile**: `@username`, bio/avatar, the user's *shared* yonders, public collections, exploration stats (places seen, total wandered, avg Yondered), follower/following counts.

---

## Feeds (`/feed`) — three tabs

- **Mine** — your own yonders (already works from Doc 2's history).
- **Following** — shared yonders from people you follow.
- **Community** — public yonders + collections, **searchable/browsable** by area and popularity. The discovery surface.

Item = **yonder card**: author, place, obfuscated trace thumbnail, `yondered N×`, distance, date, **grubs** count. Primary action **Load** ("Yonder this"); secondary **Save**, **Duplicate**, **grub**.

*State:* Following empty ("Follow people to see their wanders"); Community loading/empty/results; signed-out (sign-in CTA for Following/Community).

---

## Engagement

- **Grubs** — the one-tap like/reaction on a yonder (the kudos equivalent; keep the name "grub"). Shown as a count; tap to give/remove.
- **Save this yonder** — bookmark someone's yonder to do another time (into your `saved`).
- **No comments.** (Deliberately — limits moderation surface and keeps it calm.)
- **No competitive surfaces** — no speed/pace ranking. Any "highlights" stay exploration-based and gentle.

---

## Screens (additions)

- `/feed` — **Mine · Following · Community** tabs (Community searchable).
- `/u/[username]` — someone's **profile** (shared yonders, collections, stats, **Follow**).
- `/u/[username]/followers` · `/following` — connections lists.
- `/yonder/[id]` — a **shared yonder**: obfuscated trace, stats, **grubs**, **Load / Save / Duplicate**, report.
- **Collection / public-list detail** — reuse `/lists/[id]` when `visibility = public`; **Load / Duplicate**.
- `/you` gains your **public profile** view + edit; `/you/settings` gains **privacy zones**, **default visibility**, **blocked users**.

---

## Data model additions (Supabase, RLS)

```sql
-- profiles: add
alter table profiles add column username text unique;
alter table profiles add column bio text;
alter table profiles add column avatar_url text;
alter table profiles add column is_private boolean default false;

-- yonders: add
alter table yonders add column visibility text default 'private'
  check (visibility in ('private','followers','public'));
alter table yonders add column track_public jsonb;   -- obfuscated; precise `track` stays owner-only
alter table yonders add column caption text;

-- lists: add (public list = collection)
alter table lists add column visibility text default 'private'
  check (visibility in ('private','public'));
alter table lists add column description text;

create table follows(follower_id uuid, following_id uuid,
  status text default 'accepted' check (status in ('pending','accepted')),
  created_at timestamptz default now(), primary key(follower_id,following_id));
create table grubs(yonder_id uuid, user_id uuid, created_at timestamptz default now(),
  primary key(yonder_id,user_id));
create table blocks(blocker_id uuid, blocked_id uuid, primary key(blocker_id,blocked_id));
create table reports(id uuid primary key default gen_random_uuid(),
  reporter_id uuid, target_type text, target_id uuid, reason text, created_at timestamptz default now());
```
**RLS:** owners read/write own rows; `visibility='public'` world-readable; `followers` rows readable by **accepted** followers (policy joins `follows`); the precise `track` is **owner-only** (sharing reads `track_public`). Write and test the followers-visibility policy carefully — it's the fiddly one.

---

## Phasing within Doc 3

**Social MVP:** usernames + public profiles · follow · per-yonder visibility (private default → followers/public) · **Following + Community** feeds · **Load / Save / Duplicate** · grubs · **privacy zones + obfuscation** · block/report.
**Later:** private accounts + follow requests · richer discovery/search & filters · notifications · deeper moderation tooling.

---

## Acceptance summary (Doc 3 is "done" when…)
With privacy handled first: a user can set a yonder's visibility (default private) with the shared trace obfuscated and home protected; follow others; see **Mine / Following / Community** feeds; search the community; **Load** a shared yonder (adopt its destinations and wander their own way), **Save** it for later, or **Duplicate** it into their own lists; give **grubs**; manage a public profile; and **block/report** — all without comments, competition, live-location, or any precise trace ever leaving its owner.
