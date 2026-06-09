# Vibe Yonder — Doc 6: Discovery & the Completion Loop

**Finding places to wander to, and making what you did worth sharing.** Two halves of one loop: *discovery* brings real-world places in (nearby by category, mid-walk sidequests); the *completion loop* turns a finished wander into a rich, editable recap that feeds the social feed.

Two rules that keep it on-brand (from CLAUDE.md): **curiosity, never utility** — "find a coffee shop" means *wander toward* one, not shortest-path to caffeine; suggestions are gentle, never naggy, never sponsored (sponsored POIs = ads = banned) — and **you share places, not routes** — places-seen are publishable; the precise track never is (Doc 3 privacy invariant holds).

Doc series: 1–5 prior · **6. Discovery & the Completion Loop** ← here.

> **Status (planned).** Depends on Doc 4 primitives (bottom sheets, list rows) and Doc 5 selection (`currentId`, add-place). Already built (don't rebuild): share-sheet caption → `shared_yonders.caption`, Community map cards (`FeedMap`), `duplicateMap`, `loadCommunity`, the recap "Places seen" list + `PlacePhoto`/Wikimedia plumbing. The gap is that "places seen" is hollow (it's just pre-picked targets) and the description only exists at share time.

---

## Part A — `/api/nearby` (the POI service)

A third server route: "places of type X near a point." Distinct from geocoding (text→coords) and photos.
- **Provider behind `NEARBY_PROVIDER`**, same adapter pattern as `/api/geocode`. Prototype on **Overpass** (keyless, OSM, on-brand) — but public instances are fair-use only and flaky (observed 504s), so production moves to **Geoapify/Foursquare** (business POIs — cafés/restaurants — are exactly where OSM is thin and these shine).
- **Contract:** `/api/nearby?lat&lon&category&radius` → `[{ name, lat, lon, category, dist }]`, capped, cached. Categories map to OSM tags (`amenity=cafe`, `tourism=viewpoint`, `leisure=park`, …).
- **Caveat to log, not hide:** coverage varies; return empty gracefully.

---

## Part B — category search & sidequests

- **Category search** — a new **target source** in `CreateHub`: "find me a coffee shop / viewpoint / park nearby." Offers a *few* options to wander toward (lean exploratory — not always the nearest), each starting a normal yonder. It's a sibling of the place search, feeding the same engine.
- **Sidequests** — a live, *optional* mid-walk nudge: query `/api/nearby` around the current position, surface **one** gentle, dismissible offer ("Mosaic stairway, 160m off your path — go see it?") that, on tap, adds a place via the existing add-place seam (Doc 5). A sidequest *increases* Yondered — detours are the point.
  - **Non-naggy contract:** at most one offer at a time, a cooldown between offers, dismiss sticks, a subtle edge cue (no interrupting modal, no pulsing). Off in Clue Hunt (would spoil the puzzle). A simple per-session toggle.
  - **Never sponsored.** POIs come from neutral OSM/POI data; paid placement is banned.

---

## Part C — the completion loop

**1. "Places seen" becomes first-class & editable.**
- **Seed from what you actually reached** (visited places), not every place you aimed at — and for a free wander, it starts empty.
- **Edit in the recap (a bottom sheet):**
  - **Add** — manual search (reuses `usePlaceSearch`), and **suggest-from-route**: tap "near your route" POIs from `/api/nearby` along the track to confirm "yes, I saw that." (Suggest-from-route is gated on Part A; manual add ships first.)
  - **Remove** — drop a place you skipped.
- **Persist** the edited list to the yonder (`destinations`) and, if shared, re-publish so the card's "N places seen" and "Yonder this" reflect reality. Each row shows its `PlacePhoto`.

**2. Description on the yonder, written in the recap.**
- Add a **caption/note on the yonder itself** (model + `yonders` migration), written via a "Say a word about this wander…" field in the recap — so descriptions are part of *finishing*, not buried in share.
- The share sheet **pre-fills** from it (caption currently lives only on `shared_yonders`).

**3. Recap → share → feed cohesion.**
- The feed card (caption · trace memento · Yondered · "N places seen" · grub · Save · Yonder this) already exists; this part just guarantees its inputs are real and editable. Verify the card reflects edited places + description after re-share.

---

## Data / migrations

- `yonders.caption text null` (+ `SavedYonder.caption`, dual-mode `lib/data` read/write, localStorage parity). RLS unchanged (owner-only).
- No schema change for places-seen — it reuses `destinations` (now user-curated). Re-publish path already exists in `sharing.ts`.

---

## Brand guardrails

- **Curiosity over utility** everywhere: category search and sidequests are about *wandering toward* discoveries, not efficient retrieval.
- **Gentle, unsponsored, dismissible** sidequests; honour hide-numbers and Clue Hunt's no-spoiler rule.
- **Privacy invariant intact:** places-seen + caption are shareable; the precise track stays owner-only and obfuscated when shared.

---

## Done when

- `/api/nearby` returns category POIs (Overpass), env-swappable; category search starts yonders from `CreateHub`.
- Sidequests offer at most one gentle, dismissible nearby place mid-walk and add it via the existing seam; off in Clue Hunt.
- Recap edits places-seen (add via search now, suggest-from-route when nearby lands; remove) and persists + re-shares; description is written in the recap and pre-fills share.
- The community card shows edited places + description after re-share. `tsc`/`eslint`/`next build` green.
