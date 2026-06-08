# Handoff — for the next Claude Code session

You are picking up Vibe Yonder mid-build. Read this first, then CLAUDE.md, then the relevant spec under `docs/spec/`.

---

## Where we are (as of commit `1d8e388`)

- **Doc 1 (Solo MVP) — shipped and polished.** Three yonder types (Single / Collection / Ordered), full-bleed scope with ghosts + dot-by-position + chevron-by-position rules, pinch-zoom + drag-pan with snapping scale key, inline arrival chip ("You're at {name}? · Visited ✓ · Not yet"), "+ Add place" bottom sheet, recap with editable title + Do again + Save for later, brand voice on the home, tightened composer.
- **Doc 2 (Account & History) — surface area scaffolded.** Routes `/you`, `/you/settings`, `/favourites`, `/lists`, `/lists/new`, `/lists/[id]`, `/recap/[id]` all exist. BottomNav (Explore · You). Hide-numbers toggle is live in `/you/settings` and actually hides StatStrip + accuracy + live distance on the walk. Lists carry persistent visited state across sessions via `localStorage`.

Both docs run against `lib/storage.ts` (localStorage) today. **Supabase wiring is the next big chunk.**

---

## What's pending — pick these up in order

### 1. Wire dual-mode `lib/storage.ts`

Right now every read/write hits localStorage. The next session should branch every operation: if `getSupabase()` returns a client AND there's a signed-in user, use Supabase; otherwise localStorage.

- Hooks already in place: `lib/auth.ts` exports `useAuthUser`, `persistYonder`, `importGuestYonders`. `lib/supabase/client.ts` is env-aware (returns `null` if `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` aren't set).
- The functions to extend (current sync `lib/storage.ts`): `loadYonders`, `pushYonder`, `updateYonder`, `deleteYonder`, `getYonder`, `loadFavourites`, `pushFavourite`, `removeFavourite`, `isFavourite`, `loadLists`, `getList`, `saveList`, `deleteList`, `loadSaved`, `pushSaved`, `removeSaved`.
- They are currently all sync. Switching some to async will ripple to `useEffect` callers in `YouHub`, `FavouritesView`, `ListsView`, `ListDetail`, `RecapViewer`. Plan that refactor before writing code.
- Pattern: keep sync localStorage fallback under the same names; expose async `data.xxx()` wrappers in a new `lib/data.ts` that callers prefer when auth is configured.

### 2. Run migrations against the live Supabase project

Project ref: `kgnoqplliyrpaehxjgjw`. MCP server is wired in `.mcp.json` and the user is authenticated. Once you spawn in a session inside `/Users/tommy/vibe-yonder` the `supabase` MCP tools will be available. Migrations to apply, in order:

1. `supabase/migrations/0001_init.sql` — profiles, places, lists, list_items, yonders + RLS + sign-up trigger.
2. `supabase/migrations/0002_doc2.sql` — adds `lists.mode`, the `saved` table, and the `settings` table (all RLS'd).

### 3. Pull `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Use the MCP to fetch them; write to `.env.local` (gitignored — `.env.example` already documents the names). The user explicitly said these are safe to share.

### 4. Guest → account import on first sign-in

`lib/auth.ts` already has `importGuestYonders(yonders, userId)` that writes to Supabase and is called from `App.tsx` once we see a signed-in user. Two things to add:

- After cloud-import succeeds, **clear local yonders** (the call site does this). Verify it still triggers once data layer is dual-mode.
- Import favourites + lists + saved-for-later the same way. Currently only yonders are imported.

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
- `lib/storage.ts` — current data layer. The thing to make dual-mode.
- `lib/auth.ts` — Supabase auth wrappers + persistYonder + importGuestYonders.
- `lib/supabase/client.ts` — env-aware singleton.
- `supabase/migrations/0001_init.sql` + `0002_doc2.sql` — schema to apply.
- `.mcp.json` — Supabase MCP wiring (user is already authed).
- `.env.example` — vars to drop into `.env.local`.

Good luck. Don't optimise the journey.
