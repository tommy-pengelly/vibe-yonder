# Vibe Yonder — Doc 4: Foundations & IA

**The rework's bedrock.** Before more features, extract the *implicit* design system into real primitives and lock the information architecture. Today every screen hand-rolls its own header + wrapper + empty state, so they drift (sparse Maps, shapeless Explore). Fix it once, rebuild on it.

Two rules that keep it on-brand (from CLAUDE.md): **the scope is sacred** — these primitives are for the *member* screens (Feed, Maps, Explore, Me, recap), never the full-bleed walk void, which stays borderless and card-free — and **calm, not busy** — one hero + one primary action per screen; empty states invite, they don't nag.

Doc series: 1. Solo MVP · 2. Account & History · 3. Community & Social · **4. Foundations & IA** ← here · 5. Yonder Engine & Modes · 6. Discovery & Completion.

> **Status (planned).** Builds on the in-flight redesign (Phases A–D: 5-slot nav, Explore tab, `CreateHub` + `usePlaceSearch`, Saved folded into Maps, walk destinations panel). The nav shell already lives in `AppChrome`. This doc turns the repeated `max-w-md` + kicker/Fraunces-title pattern into shared components and reconciles the nav with CLAUDE.md (which still describes the old 3-tab bar).

---

## Why now

The pattern already exists, copy-pasted across ~10 screens:
```
<div className="flex-1 flex flex-col w-full max-w-md mx-auto px-5 pt-N pb-10 gap-6">
  <header> <span kicker/> <h1 font-display/> </header>
  …content…
</div>
```
Copy-paste means: inconsistent padding (`pt-6` / `pt-8` / `pt-10`), three different empty-state treatments, no shared list row or card, and bottom sheets re-implemented per use. Extracting primitives makes every later screen cheaper *and* consistent, and is the only way "standard layouts" actually holds.

---

## The primitives (`components/ui/`)

Built from existing tokens (`--background`, `--surface`, `--surface-2`, `--border`, `--muted`, `--warm`, `--accent`). No new colours.

- **`PageScaffold`** — the member-screen wrapper: `flex-1 flex flex-col w-full max-w-md mx-auto px-5` + standard top/bottom padding (accounting for the persistent bottom nav) + `gap`. One source of truth for page rhythm.
- **`PageHeader`** — `{ kicker, title, back?, action? }`. The uppercase tracked kicker + Fraunces title; optional back chevron (left) and a single action slot (right, e.g. Maps' `＋`). Replaces every hand-rolled `<header>`.
- **`EmptyState`** — `{ icon, title, body, action? }`. Centred, generous, *inviting* — turns "No maps yet." (a lonely grey line) into an illustrated-ish prompt with a clear primary action. This is the single biggest visible fix.
- **`SegmentedTabs`** — the Feed's Mine/Following/Community and Explore's Recent/Popular. One control, consistent active state (amber underline or pill), keyboard + aria.
- **`BottomSheet`** — mobile-first, the `AuthModal` idiom (scrim, rounded top, drag affordance, `Esc`/scrim close, focus trap). **The standard for every transient control** going forward (share, places-seen editing, "go here now", add-place). Codified once.
- **`ListRow`** — `{ leading?, title, subtitle?, trailing?, onClick? }`. The repeated "thumbnail + name + sub + chevron" row (Maps, MapDetail, search results, favourites).
- **`Card`** — the bordered/rounded container for Feed/Community (already in `components/feed/Cards.tsx`); generalise its shell so map/yonder/place cards share one frame.

*Each primitive ships with the screens that adopt it in the same commit — no orphan components.*

---

## IA & navigation (reconcile, then lock)

The app drifted to a **5-slot bottom bar**; CLAUDE.md still says 3. Make the app canonical and update the doc.

- **Bottom nav (locked):** `Feed · Maps · ⊕ · Explore · Me`. The centre **⊕** (telescope) launches a yonder (`CreateHub` → `/walk`); it is an action, not a destination. The walk is an immersive takeover with **no nav** (`AppChrome` `IMMERSIVE`).
- **Tab definitions:**
  - **Feed** (`/`) — your wanders + people you follow. Guest landing.
  - **Maps** (`/maps`) — your reusable plans (a map = a saved set of places). Empty state must sell the concept, not apologise for being empty.
  - **⊕** — `CreateHub` "Where to?" sheet: search a place, build a set, load a map/favourite, or **just wander** (see Doc 5).
  - **Explore** (`/explore`) — community discovery. **Fix the "double search":** today two stacked bare inputs (people vs places). Make it **one search field with a scope toggle** (`Explorers | Places`) so there's a single, obvious affordance, then Recent/Popular for the place results. Same data, one shape.
  - **Me** (`/you`) — profile-forward: your stats, maps, favourites, settings, sign in/out.
- **CLAUDE.md sync:** update the "Screens & pages" + nav section to the 5-slot reality and the `/maps` vocabulary (the doc still references the old bar and `/lists` lineage in places).

---

## Brand guardrails

- Primitives are for **member screens only**. The **scope stays a borderless void** — never wrap it in `Card`, never give it a `PageHeader`.
- **Amber stays precious** — one primary action per screen; `EmptyState` and `SegmentedTabs` use it sparingly (a single accent, not a wash).
- **Minimal motion** — `BottomSheet` may slide; nothing pulses. No decorative transitions on list rows or cards.
- Copy stays warm and short ("No maps yet — make one and wander a chain of places, any time."), never coachy.

---

## Done when

- `components/ui/` exists and **every member screen** (`MapsView`, `ExploreView`, `Feed`, `MapDetail`, `Recap`, `FavouritesView`, `ProfileView`, `SettingsView`, `YouHub`) renders through `PageScaffold` + `PageHeader`; no hand-rolled headers remain.
- Maps and Explore match the intended layouts: Maps has an inviting empty state and a clean populated list; Explore is one search + scope toggle, not two bare inputs.
- The 5-slot nav is the single source of truth and CLAUDE.md describes it accurately.
- `tsc`, `eslint`, `next build` green; no visual regressions on the walk/recap.
