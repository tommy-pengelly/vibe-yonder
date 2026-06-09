# Vibe Yonder — Doc 5: Yonder Engine & Modes

**What a yonder *is*, made fluid.** Today you pre-commit to one of three rigid shapes (Single / Collection / Ordered) and the focused target is auto-computed. This doc replaces that with a simpler, more human model — **a bag of places where you decide what's next, or clear them and just wander** — and adds *play modes* (clue hunt, tour, straight-line) as a separate axis on the same reusable engine.

Two rules that keep it on-brand (from CLAUDE.md): **getting lost is the point, not optimising** — modes add *play*, never pace/efficiency; a race against the clock is banned — and **the numbers are optional** — every mode must work with numbers hidden, leaving just you, the marker, and the place.

Doc series: 1–4 shipped/foundational · **5. Yonder Engine & Modes** ← here · 6. Discovery & Completion.

> **Status (planned).** The walk engine is already mode-agnostic and reusable: sensors → `track` → `Scope` canvas → arrival detection (`haversine < ARRIVAL_RADIUS_M`) → `summarize()` stats. Launch is decoupled via `sessionStorage["vibe-yonder.start"]` → `App.beginYonder`. This doc changes the *target/objective* layer above that engine, not the engine itself.

---

## Part A — the fluid selection model

**Problem.** `YonderMode = single | collection | ordered` forces a decision up front and conflates two ideas (how many places vs how they're sequenced). The focused target is auto-picked (nearest unvisited), so the user can't simply say "go *here* now." And there's no first-class way to wander with **no** destination — the app's purest expression.

**Model.** A yonder holds **a set of places** + an **optional `currentId`** (the one the marker points at):
- **Go here now** — tap any place → it becomes `currentId`; the marker swings to it. Explicit, not inferred. (Replaces the implicit `activeIndex`/`manualFocusId` dance.)
- **Wander (no target)** — remove all places, or tap "Just wander" → `currentId = null` and the set is empty. The scope is pure void: just the dot and your trail. Distance/time/Yondered still accrue. This is the original aimless mode, now first-class and reachable in one tap.
- **Sequence is a property, not a mode.** "Step through in order" becomes a toggle on a set (was Ordered); with it off, any place can be `currentId` at any time (was Collection); one place is just a set of one (was Single). The three modes collapse into *set + ordered? + currentId*.

**Where it shows:**
- **`CreateHub`** — building a set already works; add a clear **"Just wander"** entry (start with zero places) alongside "New map" / search.
- **Walk destinations panel** (Phase D) — each place gets **Go here now** (set current) and remove; a **Clear all → wander** action; live "add a place" stays. With an empty set the panel reads "Wandering free — add a place any time."

**Migration.** Keep `mode` in storage for back-compat (derive it on save: 0 places → still valid; ordered flag → `ordered`; else `collection`/`single` by count). The `Target`/`ActiveYonder` types gain `currentId` semantics; `activeIndex` can be derived from it during transition.

---

## Part B — play modes

A **`PlayMode`** is a *descriptor*, registered in one place, that configures the experience over the same engine. It is orthogonal to the selection model (any mode can have 0..n places, ordered or not).

```ts
type PlayMode = {
  id: "wander" | "tour" | "cluehunt" | "beeline";
  label: string;
  reveal: { marker: boolean; distance: boolean }; // cluehunt hides the marker
  clues?: Record<string, string>;                 // text shown instead of a marker
  poiInfo?: boolean;                               // tour: blurbs en route / at arrival
  score?: (track, places, summary) => Stat;        // the brag for this mode
  complete?: (state) => boolean;                   // reached / all-visited / on-line
};
```
Plug points (all already exist): `reveal` → `Scope` props (generalise today's `hideNumbers`); `score`/`complete` → beside `summarize()` + arrival; `poiInfo` → reuses the Wikimedia plumbing (`/api/place-photo` + a Wikipedia-extract endpoint); `clues` → render where the marker label would be.

**Modes to ship (most on-brand first):**
1. **Clue Hunt** — marker hidden, a text clue per place ("the bench where two paths cross"). Arrival still by proximity. Pure "find it with your eyes." Build first.
2. **Tour** — as you near/reach a place, a short Wikipedia blurb + photo. Curiosity, not navigation. Reuses Doc-3/photo work.
3. **Straight-Line Mission** (GeoWizard collab aspiration) — pick A→B; the scope shows your bearing + a faint corridor; live "off the line by X". **Scored by deviation/straightness ("max stray", "% in corridor"), never by time/speed.** This is the inverse of wander (minimise stray vs maximise it) on the *same* track-vs-line maths.

**New primitive:** `crossTrack(p, a, b)` in `lib/geo.ts` — perpendicular distance from point `p` to the great-circle through `a→b`. Powers the straight-line live readout and score. Pure, unit-testable; lands before the mode.

---

## Brand guardrails

- **No race / no ASAP.** Completion may be scored by coverage or Yondered, **never elapsed time**. Don't even add a time-as-score primitive to `PlayMode`.
- Straight-line is a **deliberate challenge mode**, never the default, never framed as efficiency. A straight line is the most gloriously *inefficient* way to travel — that's the joy.
- Every mode honours **hide-numbers**; the marker/clue is the hero, metrics optional.
- **Heading-up only**, void at rest — modes never add rings, tiles, or a map to the scope.

---

## Done when

- The three rigid modes are gone from the UX: a yonder is a set + ordered? + `currentId`; "Go here now" and "Clear all → wander" work from the walk panel; starting with zero places is one tap from `CreateHub`.
- `crossTrack` exists with tests; `PlayMode` registry exists; Clue Hunt + Tour + Straight-Line are selectable and each respects hide-numbers.
- No mode scores by time; the engine (sensors/track/stats/scope) is unchanged underneath.
- `tsc`, `eslint`, `next build` green.
