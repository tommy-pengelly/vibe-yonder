# Handoff — for the next Claude Code session

You are picking up Vibe Yonder mid-build. Read this first, then CLAUDE.md, then the relevant spec under `docs/spec/`.

---

## Latest session (2026-06-09) — rework Docs 4–6 kicked off

Specs `docs/spec/04-foundations-ia.md`, `05-yonder-engine.md`, `06-discovery-completion.md` written. Shipped to `main` and pushed:

- **Brand assets / splash / metadata** — favicon, app icon, apple icon, OG + Twitter images, `app/manifest.ts` (installable PWA), richer `layout.tsx` metadata, and `BootSplash` (calm mark+wordmark fade on cold load). Asset pack source: `vibe-yonder-assets.zip` (logos/icons in `public/`).
- **Doc 4 Foundations** — `components/ui/` primitives (`PageScaffold`, `PageHeader`, `EmptyState`, `SegmentedTabs`, `BottomSheet`, `ListRow`). Rebuilt **Maps** (inviting empty state) and **Explore** (one search + Places/Explorers scope toggle, was two bare inputs). CLAUDE.md synced to the 5-slot nav.
- **Doc 5 selection (Part A)** — clear-all-to-wander + a "Just wander" entry: zero targets is now a first-class pure-void wander. "Go next" (go-here-now) already existed from Phase D.
- **Doc 6 completion loop (no-new-service half)** — description written in the recap (`SavedYonder.caption`), pre-fills share; places-seen is editable (add via place-search bottom sheet / remove), persisted to `destinations`.

### Feedback pass (2026-06-09, also pushed)
- "Reusable yonders" → "Your maps"; contrast lifted across tokens; **POI-scatter cards** on Maps list + MapDetail (shared `components/ui/viz` + `toUnitBox`). Fixed the add-place sheet (was opening behind the Destinations sheet).
- **Component library = shadcn/Radix** (user-chosen): deps in (`@radix-ui/react-dialog`, `@radix-ui/react-tabs`, `vaul`, `clsx`, `tailwind-merge`, `cva`); `lib/utils` `cn`. `BottomSheet` → vaul; walk sheets + ShareControl migrated; `AuthModal` → Radix Dialog; `SegmentedTabs` → Radix Tabs. (2 moderate transitive npm-audit warnings — check before prod.)
- **Explore → "Find"** (label/kicker; `/explore` route kept).
- **Autosave**: map-editor drafts + resume an in-progress yonder (`lib/storage` drafts/session; App restores on mount, clears on finish/discard).
- **Map sharing**: `setMapVisibility` + `MapShareControl` bottom sheet on MapDetail; "Shared" badge in MapsView. (`maps.visibility` already existed — no migration.)
- Remaining shadcn sweep: other bespoke buttons/inputs could move to kit components incrementally; not urgent.

### Session 2 (2026-06-09 cont.) — nav restructure + discovery engine
- **3-tab nav** (Community · ⊕ · Me): `CommunityView` at `/` (Discover = old Explore + search; Following). Centre ⊕ shows the brand spyglass mark. Me (`YouHub`) gained a Maps row. `Feed.tsx`/`ExploreView.tsx` removed; `/explore`→`/`. CLAUDE.md nav updated.
- **Discovery engine** (the big one): `/api/nearby` (Overpass, keyless, env-swappable `NEARBY_PROVIDER`/`OVERPASS_URL`, 2 endpoints, 6h cache) + `lib/nearby` category catalogue. **Category search** ("Find me a…" chips) in CreateHub. **Sidequests** via `hooks/useSidequest` — gentle, throttled, dismissible mid-walk nudges to see-worthy POIs; "Not now" disables for the walk. Live-tested `/api/nearby` (9 cafés near Dolores Park).
- **Favourite aliases** (Home/Work/café) — `FavouritePlace.alias`, inline rename in FavouritesView; cloud best-effort pending migration 0012.
- **Autosave** (map drafts + resume in-progress yonder), **map sharing** (`MapShareControl` + visibility), **vaul/Radix** sheets+dialog+tabs, **bigger search sheets** (60dvh), contrast lift, POI cards — all shipped earlier this session.

### ⚠️ Still NOT built (next): game modes
Straight-line mission (GeoWizard, scored by deviation/straightness — never time), clue hunt, tour — under the ⊕. Then community-map **scoreboards** scored by exploration (Yondered / straightness), never speed. `crossTrack()` in `lib/geo.ts` is the first brick. Also: map-area derivation+search (column `maps.area` ready via 0012), the silent finish-bounce UX, first-run onboarding, collapse legacy `YonderMode`.

### ⚠️ Action items — apply migrations 0011 + 0012
`0012_place_alias_map_area.sql` (places.alias, maps.area) joins `0011_yonder_caption.sql` as written-but-unapplied (live-DB apply blocked for the agent). Apply both to enable cloud caption + alias persistence.

### ⚠️ Action item — apply migration 0011
`supabase/migrations/0011_yonder_caption.sql` (adds `yonders.caption`) is **written but NOT applied** — the live-DB apply was declined by the safety classifier. Apply it (e.g. `supabase db push`, or the supabase MCP `apply_migration`) so signed-in users' recap descriptions persist to cloud. Until then: guest/localStorage works fully; `updateYonder` writes caption best-effort and self-heals once the column exists.

### Still spec'd, NOT yet built (pick up next, in order)
- **Doc 5 Part B — PlayMode framework**: `crossTrack()` in `lib/geo.ts` (+ tests) first, then Clue Hunt → Tour → Straight-Line (GeoWizard). Scored by deviation, never time.
- **Doc 6 Part A/B — discovery**: `/api/nearby` (Overpass→Geoapify, env-swappable), category search in `CreateHub`, sidequests (reuse `onAddPlace`; non-naggy, never sponsored). Then wire **suggest-from-route** into the recap places-seen editor (depends on `/api/nearby`).
- Collapse the legacy `YonderMode` (single/collection/ordered) into the fluid set + `currentId` model end-to-end (Part A finished the wander/clear side; the mode enum still lingers for back-compat).

### Verified this session
`tsc --noEmit`, `eslint app components lib`, and `next build` all green after each commit. Not runtime-tested with a live signed-in session (magic-link is hard to automate) — and the new caption cloud-write needs migration 0011 before it does anything for signed-in users.

---

## Where we are (as of commit `df9c57e` + uncommitted cloud-sync work)

- **Doc 1 (Solo MVP) — shipped and polished.** Three yonder types (Single / Collection / Ordered), full-bleed scope with ghosts + dot-by-position + chevron-by-position rules, pinch-zoom + drag-pan with snapping scale key, inline arrival chip ("You're at {name}? · Visited ✓ · Not yet"), "+ Add place" bottom sheet, recap with editable title + Do again + Save for later, brand voice on the home, tightened composer.
- **Doc 2 (Account & History) — surface scaffolded AND now cloud-synced.** Routes `/you`, `/you/settings`, `/favourites`, `/lists`, `/lists/new`, `/lists/[id]`, `/recap/[id]` all exist. BottomNav (Explore · You). Hide-numbers toggle is live in `/you/settings` and actually hides StatStrip + accuracy + live distance on the walk.

### Cloud sync — DONE this session (handoff items 1–4) ⚠️ uncommitted

- **Migrations applied to the live project** (`kgnoqplliyrpaehxjgjw`): `0001_init`, `0002_doc2`, plus two new ones written this session — `0003_yonder_shape` (adds `mode` / `destinations` / `paused_ms` / `list_id` to `yonders`, which the 0001 schema was missing vs the `SavedYonder` type) and `0004_harden_trigger` (pins `handle_new_user` search_path + revokes RPC EXECUTE — clears the security advisor warnings). All 7 tables live with RLS on; `get_advisors security` is clean.
- **`.env.local` written** with `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (gitignored). Auth is now live in this build.
- **`lib/data.ts` is the dual-mode layer.** Every op (`loadYonders`, `getYonder`, `pushYonder`, `updateYonder`, `deleteYonder`, `loadFavourites`, `pushFavourite`, `removeFavourite`, `isFavourite`, `loadLists`, `getList`, `saveList`, `deleteList`, `loadSaved`, `pushSaved`, `removeSaved`) is **async** and branches: signed-in Supabase session → cloud; otherwise delegates to the sync `lib/storage.ts` (localStorage). Column names verified against the live schema.
- **All callers migrated** to `await data.*`: `App`, `YouHub`, `FavouritesView`, `ListsView`, `ListDetail`, `ListEditor`, `RecapViewer`. Their load effects now key on `user` so they re-fetch when auth resolves; mutations are optimistic + fire-and-forget where it reads better.
- **Guest → account import** is `importGuestData()` in `lib/data.ts` (yonders + favourites + lists + saved, all of them — not just yonders). It's module-guarded (runs once per app session) and triggered from `useAuthUser` in `lib/auth.ts`, so it fires regardless of which route the user signs in from. Clears local **only on success**; resets the guard on failure to retry.
- **Removed dead code:** `persistYonder` / `importGuestYonders` deleted from `lib/auth.ts` (superseded; they wrote an incomplete yonder row missing mode/destinations).
- **Verified:** `tsc --noEmit`, `eslint lib components`, and `next build` all green; dev server smoke-tested (all routes 200, no runtime errors). **Not yet runtime-tested with a real signed-in session** — magic-link sign-in is hard to automate. First human pass should sign in and confirm a yonder round-trips to the cloud and guest import fires.

---

## What's pending — pick these up in order

### 1. ~~Wire dual-mode storage~~ — DONE (see above)
### 2. ~~Run migrations~~ — DONE
### 3. ~~Pull env vars~~ — DONE
### 4. ~~Guest → account import~~ — DONE

### 4b. Settings are still localStorage-only

`lib/settings.ts` (`hideNumbers`) was deliberately left out of the cloud refactor to keep scope tight. The `settings` table exists (RLS'd, `hide_numbers` column). If you want hide-numbers to follow the user across devices, mirror the `lib/data.ts` pattern: async load that merges cloud over default, write-through on `update`. Low priority — it's a single boolean.

### 5. `/saved` page

`YouHub.tsx` shows a "Saved for later" row but it's `disabled` and links to `/saved` which doesn't exist. Build the page: list of `StoredSaved` entries, tap → either start a yonder (kind=place) or open the list (kind=list).

### 6. Heart-to-favourite from the walk

`WalkScreen` has no way to favourite the active destination. Add a small heart icon (lucide `Heart` / `HeartOff`) near the top-left destination name; tap toggles favourite via `pushFavourite` / `removeFavourite`.

---

## Optional / lower-priority follow-ups

- **Real-phone polish of the walk** (`WalkScreen.tsx`) — the arrival chip placement, the calibrate prompt, the recentre pill, the "+" sheet behaviour. Needs in-the-field testing.
- **Recap polish** — a shareable flourish on "You yondered N×" and tighter stat tiles.
- **Apple / Google OAuth** — Doc 2 calls them "optional" alongside magic-link. Magic-link works today.
- **Doc 3 (Community & Social)** — wait until Doc 2 cloud sync is solid before starting. Heavy spec; don't start it on a soft foundation.

---

## Gotchas + decisions worth keeping

- **Trivial-walk threshold is 5 m, not 30.** Lower than that and the user gets bounced back to home with no recap. Lives in `lib/constants.ts` as `TRIVIAL_WALK_M`. Don't raise it without thought.
- **The scope is a void at rest.** No visible range rings. The bottom-right scale key (snaps to 25/50/100/250/500/1000/2500/5000 m) is the *only* scale cue. See `Scope.tsx`. CLAUDE.md is explicit about this — don't drift.
- **The destination marker is a chevron, never an arrow.** No shaft, no stalk, no line to the centre. When close, it becomes a dot at its true projected position. The dot fades radially as it nears the rim (`FADE_START = 0.7`). CLAUDE.md is explicit.
- **No pace, ever.** It was removed in the Doc 1 / Doc 2 work. `summarize()` doesn't compute it. `lib/geo.ts` doesn't export `fmtPace` anymore. If you find yourself adding it, re-read CLAUDE.md's "Never add" section.
- **"Collection" / "Ordered" are the doc terms; user-facing copy is "Wander between" / "Step through".** The chip sub-labels show both. Keep this pairing.
- **Arrival is a chip, not a modal.** Doc 1 says "popup once" but we deliberately interpreted that as a quiet inline confirmation above the HUD — preserves the calm tone CLAUDE.md asks for. Don't switch to a modal.
- **BottomNav (Explore · You) shows on home / `/you` / `/favourites` / `/lists` / list detail.** Hidden during walk. Don't add it to `/walk` or you'll cover the bottom HUD.
- **Save is explicit, never auto.** When the user taps Finish a yonder goes to the recap; nothing is persisted. Save → localStorage (and Supabase when wired). Bumping someone back to home with no recap on a near-zero walk is the only auto behaviour.
- **MCP attachment is working-dir-scoped.** This handoff exists because `.mcp.json` is project-scoped to `/Users/tommy/vibe-yonder`; sessions in other dirs can't see the Supabase MCP. New session inside vibe-yonder picks it up automatically.
- **Lucide icons throughout.** No hand-drawn SVGs. If you need a new icon, reach for `lucide-react`.
- **CLAUDE.md is the brand law.** Read it before adding anything. The litmus test ("Does this make exploring more joyful, or is it optimising the journey?") kills most feature creep at the door.

---

## File map for the next session

- `CLAUDE.md` — brand rules, voice, "never add" list. Read first.
- `docs/spec/01-solo-mvp.md` — Doc 1 (shipped + polished).
- `docs/spec/02-account-history.md` — Doc 2 (surface scaffolded; cloud sync pending).
- `docs/spec/03-community-social.md` — Doc 3 (untouched).
- `lib/constants.ts` — tunables (arrival radius, trivial walk, mpp clamps, scale levels, rim fraction).
- `lib/data.ts` — **the dual-mode data layer** (cloud-or-local, async). Callers use this, not storage.ts directly. Holds `importGuestData()`.
- `lib/storage.ts` — sync localStorage layer; the guest fallback `lib/data.ts` delegates to. Has `clearGuestData()`.
- `lib/auth.ts` — Supabase auth wrappers (`useAuthUser` / `signInWithMagicLink` / `signOut`); `useAuthUser` triggers `importGuestData()` on sign-in.
- `lib/supabase/client.ts` — env-aware singleton.
- `supabase/migrations/0001_init.sql` … `0004_harden_trigger.sql` — schema (all applied to the live project).
- `.mcp.json` — Supabase MCP wiring (user is already authed).
- `.env.example` — vars to drop into `.env.local`.

Good luck. Don't optimise the journey.
