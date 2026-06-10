# Vibe Yonder — Doc 7 (Build): Implementing Ambient Discovery

**The how, file-by-file.** Doc 7 (`07-ambient-discovery.md`) is the *what & why*; this is the engineering plan to build it. Sequenced as **independently shippable phases** (one PR/commit each, in the style of the existing "Discovery engine pt.1/pt.2" commits). Each phase is green on its own — `tsc`/`eslint`/`next build` — and earlier phases ship value before the UI exists.

**Golden rule restated as code (from Doc 7 Part F):** the engine fetches **by tile, not by tick**; reveals are **lazy**; candidates are **capped**; attributions render **on screen**. These are acceptance criteria, not nice-to-haves.

**Existing seams this plugs into (verified):**
- Launch handoff — `sessionStorage["vibe-yonder.start"]` → `App.beginYonder()` (`App.tsx:95–122, 193`). Payload today: `{ targets, mode, mapId?, mapItemIdByTargetId?, name? }`.
- Add-place seam — `onAddPlace(target: Target)` already used by sidequests (`WalkScreen.tsx:446`).
- Cadence/throttle/dismissed-set template — `hooks/useSidequest.ts`.
- Storage — `read`/`write` + `vibe-yonder.<thing>.v1` keys (`lib/storage.ts`).
- Scope render — `components/Scope.tsx` draws `targets` + `track`, hit-tests taps (`onPickTarget`).
- Geo — `lib/geo.ts` (`bearing`, `haversine`, `toRad/toDeg`).

---

## Phase 0 — Foundations: pure, testable, no UI

Two pure modules with unit tests. Ships nothing user-facing; unblocks everything. **Do this first** — it's the cheap, high-confidence core.

### 0a. `lib/geo.ts` — travel-bearing + confidence estimator

A new stateful estimator, **distinct from `makeAngleSmoother()`** (that only unwraps angle for CSS; this measures *trend*). EMA of heading **unit-vectors**, displacement-weighted, distance-windowed.

```ts
export type BearingEstimate = { bearing: number | null; confidence: number }; // confidence 0..1

export function makeTravelBearing(opts?: { halfLifeM?: number; minStepM?: number }): {
  push(fix: { lat: number; lon: number }): BearingEstimate;
  value(): BearingEstimate;
  reset(): void;
};
```

Internal state: accumulator `A = {x, y}` (sum of unit-vector·weight) and total weight `W`.
On `push(fix)`:
1. If no previous fix → store, return `{bearing: null, confidence: 0}`.
2. `d = haversine(prev, fix)`. If `d < minStepM` (default ~5 m) → ignore (jitter/standstill); return last `value()`. *This is the standstill degradation: confidence naturally decays toward the last good value and the caller falls back to the distance gate.*
3. `b = bearing(prev, fix)`; `v = {x: cos(b°), y: sin(b°)}` (use `toRad`).
4. Distance-window decay: `k = exp(-d / halfLifeM)` (default `halfLifeM ≈ 150`). `A = {x: A.x*k + v.x*d, y: A.y*k + v.y*d}; W = W*k + d`.
5. `m = {x: A.x/W, y: A.y/W}`; `confidence = hypot(m.x, m.y)` (∈ 0..1); `bearing = (atan2(m.y, m.x)°+360)%360`. Store prev = fix.

**Tests** (`lib/geo.test.ts`): straight line N → `confidence → ~1`, `bearing ≈ 0`; sharp U-turn → confidence dips then recovers on the new bearing; jitter-in-place (sub-`minStepM` noise) → no update, confidence stable; circular wrap (heading oscillating 350°/10°) → bearing ≈ 0, **not** 180° (the unit-vector guard).

### 0b. `lib/discovery.ts` — the `score()` brain (`draw ≥ cost`)

```ts
import type { LatLon } from "./types";
import { type NearbyPlace } from "./nearby";

export type Candidate = NearbyPlace & {
  id: string;            // stable OSM "node/123" or coord-hash fallback
  wiki?: boolean;        // has wikipedia/wikidata tag
  importance?: number;   // Photon importance passthrough, 0..1
  klass?: "any" | "interesting" | "notable"; // ring class the route assigned
};

export type ScoreCtx = {
  origin: LatLon;
  travelBearing: number | null; // null ⇒ no directional term (degrade to distance gate)
  confidence: number;           // 0..1, scales the directional penalty
  activeGuide: string | null;   // a Category.key, or null
  familiarity: (id: string) => number; // 0..1 penalty from the ledger (Phase 2)
};

export type Scored = Candidate & {
  dist: number; draw: number; cost: number; value: number; surfaced: boolean;
};

export function notability(c: Candidate): number; // pure, 0..1
export function score(c: Candidate, ctx: ScoreCtx): Scored;
export function rankCandidates(cs: Candidate[], ctx: ScoreCtx, cap?: number): Scored[];
```

**`notability(c)`** (0..1, all free signals): `wiki` → 0.9; else `klass==="interesting"` → 0.55; else clamp `importance` (if present) into ~0.2–0.7; else plain named amenity → 0.2.

**`score(c, ctx)`** — everything in normalized units so the inequality is meaningful:
- `dist = haversine(ctx.origin, c)`.
- `costDist = dist / REFERENCE_M` (REFERENCE_M ≈ 1200 — a node at the reference distance costs ~1 "draw unit").
- `directionPenalty`: if `travelBearing == null` → 0. Else `Δ = angleDiff(bearing(origin→c), travelBearing)`; `behindness = (1 - cos Δ)/2` (0 ahead → 1 behind); `costDir = DIR_WEIGHT * ctx.confidence * behindness` (DIR_WEIGHT ≈ 1.2). *Confidence gates it: churn → ~0 → all directions open.*
- `cost = costDist + costDir`.
- `guideBoost`: `activeGuide && c.category === activeGuide` → `+GUIDE_BOOST` (≈ 0.5, **modest — leans, never blinds**; never zero non-matching).
- `draw = notability(c) + guideBoost − ctx.familiarity(c.id)`.
- `value = draw − cost`; `surfaced = value ≥ 0`.

**`rankCandidates`** → map `score`, sort by `value` desc, `filter(surfaced)`, `slice(cap ?? 6)`. (The on-canvas cap; Part B per-ring caps happen server-side.)

All constants in a `const TUNING = {...}` block at top, commented "tunable."

**Tests** (`lib/discovery.test.ts`): far-ordinary loses to near-ordinary; far-but-`wiki` survives where far-ordinary doesn't (the ring intent); a node directly behind needs much higher notability to surface at high confidence, but surfaces freely at confidence 0; an active guide lifts its category but a notable non-guide node still surfaces (lean-not-blind); familiarity=1 sinks an otherwise-strong candidate.

---

## Phase 1 — Engine data: ring tiers + ids + wiki tags

### `lib/nearby.ts`
- Extend `NearbyPlace` with `id: string`, `wiki?: boolean`, `importance?: number`, `klass?: "any" | "interesting" | "notable"`.
- Add ring config (drives the query + the `klass` tag):
```ts
export const RINGS = [
  { maxR: 400,  klass: "any" },          // active categories
  { maxR: 1200, klass: "interesting" },  // tourism/historic/leisure=park/viewpoint
  { maxR: 3000, klass: "notable" },      // only [wikipedia]/[wikidata]
] as const;
export const INTERESTING_FILTERS = ['"tourism"', '"historic"', '"leisure"="park"', '"tourism"="viewpoint"'];
```

### `app/api/nearby/route.ts`
- Build **one** Overpass union across rings (still a single request):
  - Ring 0: the category's `cat.filters`, `around:400`.
  - Ring 1: `INTERESTING_FILTERS`, `around:1200`.
  - Ring 2: `["wikipedia","wikidata"]` presence, `around:3000`.
- Keep the **expensive-radius ⟺ sparse-filter** invariant: the 3 km clause matches only wiki-tagged nodes (sparse), so the union stays light. Add a code comment asserting this.
- `out center tags 60;` so we get `wikipedia`/`wikidata` tags back.
- Per-element: `id = "${el.type}/${el.id}"`; `wiki = !!(tags.wikipedia || tags.wikidata)`; assign `klass` by which ring radius it falls in (compute from `dist`); pass `importance` if present (Overpass won't have it — leave undefined; Photon path sets it).
- Per-ring caps before returning (≈ 4 / 3 / 2). Preserve graceful `[]` on failure.
- **Caching/cadence:** the client snaps coords before calling (Phase 3), so no server state needed; keep the existing `revalidate: 6h`. Add a one-line comment that the snapped lat/lon is what stabilises the edge-cache key.

**Done when:** `curl '/api/nearby?category=cafe&lat=..&lon=..'` returns items with `id`, `klass`, and `wiki` flags; far results are wiki-only; one Overpass round-trip. No client changes required yet.

---

## Phase 2 — The familiarity ledger (seen / skipped)

### `lib/discovery-ledger.ts`
```ts
export type LedgerEntry = { id: string; status: "seen" | "skipped"; at: number; distAt: number };
// key: "vibe-yonder.discovery.v1" — add to lib/storage.ts KEYS or keep module-local read/write
export function markSeen(id: string, distTravelledM: number): void;
export function markSkipped(id: string, distTravelledM: number): void;
export function familiarity(id: string, distTravelledNowM: number): number; // 0..1
export function clearLedger(): void; // called from clearGuestData()
```
- Storage: reuse the `read`/`write` pattern. **Bounded:** cap ~200 entries, evict oldest on write.
- `familiarity`:
  - `seen` → `0.85` (long-lived; drops it from *mystery* surfacing but not a hard 1, so a genuinely huge draw could still resurface as a known landmark).
  - `skipped` → **decays with distance travelled since**: `0.6 * max(0, 1 − (distNow − distAt)/COOLDOWN_M)` (COOLDOWN_M ≈ 600). Past the cooldown → 0 (can resurface).
  - no entry → 0.
- **Privacy:** on-device only; **never** serialized into a yonder/share. Add `clearLedger()` to `clearGuestData()` in `lib/storage.ts` so sign-in import wipes it like other guest data.

**Tests:** seen stays penalized far away; skipped penalty decays to 0 after COOLDOWN_M of travel; ledger never exceeds cap.

> `distTravelledM` = cumulative walked metres, already derived in `lib/stats.ts` from the track — pass it in; don't recompute.

---

## Phase 3 — `useDiscovery` hook (tile fetch + pool + reveal)

`hooks/useDiscovery.ts` — generalizes `useSidequest`'s cadence discipline into a live, scored candidate pool. This is the engine's runtime.

```ts
export type ScopeCandidate = { id: string; lat: number; lon: number; revealed: boolean; name?: string };
export function useDiscovery(opts: {
  position: Fix | null;
  track: Fix[];               // for travel-bearing + distTravelled
  enabled: boolean;
  activeGuide: string | null; // category key or null
  committedIds: Set<string>;  // already added as targets — exclude
}): {
  candidates: ScopeCandidate[];     // capped, gated, for the Scope
  reveal: { id: string; name: string; photo?: PlacePhotoData; blurb?: string } | null;
  skip: (id: string) => void;       // ledger.markSkipped + drop from pool
  commit: (id: string) => Target | null; // ledger.markSeen + returns a Target for onAddPlace
};
```

Internals:
- **Travel-bearing ref:** `makeTravelBearing()`; `push` on each new `position`. Hold `{bearing, confidence}`.
- **Pool:** `Map<id, Candidate>`. **Tile fetch (by tile, not tick):**
  - Snap `position` to a grid: `cell = (round(lat/STEP), round(lon/STEP))`, STEP ≈ 0.01° (~1 km).
  - Fetch only when **cell changed** since last fetch, or pool gated-count < floor — AND a throttle (`≥60s`, reuse the `useSidequest` `busy`/`lastQueryAt` pattern) permits.
  - Categories to fetch: `activeGuide ? [activeGuide] : DEFAULT_AMBIENT_CATS` (the `SEE_CATEGORIES` "things to see" set, not food/errands). Merge results into pool by `id` (dedupe).
- **Scoring each fix:** build `ScoreCtx` (origin = position, travelBearing/confidence from ref, familiarity = `(id)=>familiarity(id, distTravelled)`, exclude `committedIds`). `rankCandidates(pool, ctx, 6)` → map to `ScopeCandidate` with `revealed = dist < REVEAL_M` (≈ 60 m).
- **Reveal (lazy):** when a candidate first crosses `REVEAL_M`, fetch `/api/place-photo` + the Wikipedia blurb **once**, cache by id. Only the closest revealed candidate populates `reveal`.
- `skip(id)`: `markSkipped`, remove from pool. `commit(id)`: `markSeen`, return `Target` (`{id: crypto.randomUUID(), name, label:"", lat, lon, visited:false}`).

**Reuse, don't duplicate:** lift the throttle/`busy`/dismissed-set mechanics from `useSidequest`. (Phase 7 folds sidequest *into* this hook; keep separate until then.)

**Done when:** a unit/integration test (mock `fetch`) shows: walking across a cell triggers exactly one fetch; standing still triggers none; pool scored & capped at ≤6; crossing REVEAL_M fires exactly one photo fetch.

---

## Phase 4 — Scope: candidate dots + reveal-on-approach

### `components/Scope.tsx`
- Add optional prop `candidates?: ScopeCandidate[]` and `onPickCandidate?: (id: string) => void`.
- Render a **candidate layer**, visually distinct from `targets`:
  - **Unrevealed** → a faint, small dot (low alpha, no label) at its projected position (reuse `projectAt`/`applyRot`). Honours the void aesthetic — *faint, nameless, sparse*.
  - **Revealed** → a brighter dot with the name label (smaller weight than a committed target's amber marker).
  - Off-canvas candidates: **do not** draw an edge chevron (that's reserved for the committed destination/`activeTarget`) — unrevealed mystery stays on-canvas only.
- Add to `hitsRef` hit-testing so a tap on a candidate calls `onPickCandidate`.
- Hard cap drawn candidates at 6 (defensive; the hook already gates).

**Done when:** candidate dots render faint and sparse on the void, brighten+label within REVEAL_M, and are tappable. No regression to trail/target/chevron drawing.

---

## Phase 5 — Launch path + guide toggle (the user-facing mode)

### Launch handoff (`App.tsx` + `CreateHub.tsx`)
- Extend the start payload type with `play?: "ambient"`:
  ```ts
  { targets: Target[]; mode: YonderMode; mapId?; mapItemIdByTargetId?; name?; play?: "ambient" }
  ```
- `App.beginYonder(targets, mode, opts)` gains `opts.play`. For `play:"ambient"`, allow **empty `targets`** (a free wander) and set a flag (`yonder.play = "ambient"` — extend `ActiveYonder` with optional `play?: "ambient"`). Relax the `payload.targets.length` guard at `App.tsx:109` to also accept `play:"ambient"` with no targets.
- `CreateHub`: add a primary entry above the search — **"Just yonder — show me what's around"** — that calls `onStart([], "collection", { play: "ambient" })`. (⊕ is the home for modes per CLAUDE.md; this is its first non-search launch.)

### `WalkScreen.tsx`
- When `yonder.play === "ambient"`, mount `useDiscovery` (alongside or instead of `useSidequest`) and pass `candidates` + `onPickCandidate` to `Scope`.
- **Guide toggle:** a row of category chips (from `CATEGORIES` in `lib/nearby.ts`) that sets `activeGuide` (local state, per-session — like `sidequestsOn`). Tapping a chip toggles it on/off ("a lens you hold up, then lower"). Off by default.
- **Reveal card:** when `reveal` is set, show a bottom card (mirror the existing sidequest offer card at `WalkScreen.tsx:406`) with name + photo + blurb + attribution, and actions **Skip** (`skip(id)`) / **Add it** (`commit(id)` → `onAddPlace`).
- Respect `hideNumbers` (no distances on the card) and the calm-motion rule (no pulsing on candidate dots).

**Done when:** ⊕ → "Just yonder" starts a destination-less walk; faint dots populate as you move; approaching one reveals name+photo+blurb; Add promotes it to a committed target (amber marker, normal arrival flow); guide chips bias what appears without hiding notable outliers.

---

## Phase 6 — Reveal content + attribution (close the licence loop)

- Wire the reveal card's photo via `/api/place-photo` (already returns `PlacePhotoData` with `author`/`license`/`source`) — render the **CC attribution** inline. Licence-clean here: ambient coords are the user's own live location (real, owned), unlike shared yonders (Doc 3) — add a comment asserting this so nobody "optimises" it onto shared views later.
- Blurb via the existing Wikimedia/Tour plumbing (Wikipedia lead extract).
- **OSM attribution:** wherever candidate POIs are shown (the walk scope's discovery layer), ensure a visible "© OpenStreetMap contributors" credit exists (a small persistent line in the walk chrome or an info affordance). This is the standing, scale-independent obligation from Doc 7 Part F.

**Done when:** every revealed photo shows CC attribution; OSM contributor credit is visible where discovery POIs appear; place-photo is never called from shared-yonder views (grep-assert).

---

## Phase 7 — Unify the existing surfaces through `score()`

Now that the brain exists, route the older surfaces through it so behaviour is consistent (and the "four surfaces, one function" claim is literally true).

- **Sidequest:** reimplement `useSidequest` as `useDiscovery` in a `mode:"sidequest"` configuration — single offer, high cost bar (a detour must be *worth* it), long cooldown — or have it consume `rankCandidates`. Keep its non-naggy contract (one at a time, cooldown, dismiss sticks). Verify no regression to the current offer card.
- **Category search** (CreateHub "find me a coffee"): rank the returned options via `score()` with the guide forced on and reveal off (the user asked, so they know) — replaces ad-hoc nearest-first sort. Keep it *exploratory* (not strict nearest).

**Done when:** sidequests and category search produce results via `rankCandidates`; the old bespoke sort/filter in `useSidequest`/CreateHub is deleted; behaviour is unchanged-or-better by manual check.

---

## Data contracts (new/changed types)

| Type | Where | Change |
|---|---|---|
| `NearbyPlace` | `lib/nearby.ts` | + `id`, `wiki?`, `importance?`, `klass?` |
| `Candidate`, `ScoreCtx`, `Scored` | `lib/discovery.ts` | new |
| `BearingEstimate` | `lib/geo.ts` | new |
| `LedgerEntry` | `lib/discovery-ledger.ts` | new (localStorage `vibe-yonder.discovery.v1`) |
| `ScopeCandidate` | `hooks/useDiscovery.ts` | new |
| `ActiveYonder` | `lib/types.ts` | + `play?: "ambient"` |
| start payload | `App.tsx`/`CreateHub.tsx` | + `play?: "ambient"`, empty `targets` allowed for ambient |

**No DB migration. No Supabase changes. RLS untouched.** (Doc 7: the engine is client + keyless edge routes only.)

---

## Tuning constants (one block, all commented "tunable")

`STEP` (tile ~0.01°), throttle (≥60s), `halfLifeM` (~150), `minStepM` (~5), `REFERENCE_M` (~1200), `DIR_WEIGHT` (~1.2), `GUIDE_BOOST` (~0.5), `REVEAL_M` (~60), ring radii (400/1200/3000), per-ring caps (4/3/2), on-canvas cap (6), seen penalty (0.85), skipped base (0.6) + `COOLDOWN_M` (~600), ledger cap (~200). Expect to tune on a real walk; keep them centralized.

---

## Test plan

- **Unit (pure, fast):** `lib/geo` bearing/confidence (straight/U-turn/jitter/wrap); `lib/discovery` score ordering (distance, direction×confidence, guide lean-not-blind, familiarity); `lib/discovery-ledger` (seen persistence, skipped decay, cap).
- **Hook (mocked fetch):** tile-not-tick (one fetch per cell crossing, none at standstill); pool dedupe + ≤6 gate; one lazy photo fetch per reveal.
- **Manual on-device:** ⊕ → Just yonder; dots appear sparse; walk toward one → reveal card with photo+attribution; Add → amber target + arrival flow; turn around → behind-you dots stay rare unless notable; toggle a guide → its category leans in, a notable outlier still appears; skip → doesn't re-nag, reappears much later; hide-numbers respected; no pulsing.
- **Guardrail greps:** no `place-photo` call reachable from shared-yonder code; no rating/score-by-quality field anywhere; OSM + CC attributions present where POIs/photos render.

---

## Brand guardrail checks (must pass review)

- No ratings/quality ranking introduced (notability only). No nearest-amenity behaviour (guides lean, never blind; ambient withholds the destination).
- Sidequest non-naggy contract intact; candidate dots are calm (faint, no pulse, ≤6).
- Skipped **decays**, never hard-blacklists (detours are features).
- Ledger never leaves the device; never serialized into a yonder or share.
- Attribution (OSM + per-photo CC) visible; place-photo never on stripped/shared coords.

---

## Out of scope (later, on-brand if built)

- Durable POI warehouse in Supabase (Doc 7: prefer transient tile cache; warehousing brings ODbL share-alike + staleness).
- Provider swap to Geoapify/Foursquare/self-hosted Overpass behind `NEARBY_PROVIDER` — only at ~10k active users (Doc 7 Part F); seam already exists.
- Cross-session "you've been here" landmark recognition from the ledger.
- Clue-Hunt/Tour play modes (sibling to ambient; reuse the same reveal plumbing).

---

## Suggested commit sequence

1. `Discovery engine pt.3: travel-bearing + score() (pure, tested)` — Phase 0
2. `Discovery engine pt.4: ring-tiered /api/nearby + ids + wiki tags` — Phase 1
3. `Discovery engine pt.5: familiarity ledger (seen/skipped)` — Phase 2
4. `Discovery engine pt.6: useDiscovery hook (tile fetch + reveal)` — Phase 3
5. `Scope: faint candidate dots + reveal-on-approach` — Phase 4
6. `Ambient mode: "just yonder" launch + guide chips` — Phase 5
7. `Reveal content + OSM/CC attribution` — Phase 6
8. `Route sidequests + category search through score()` — Phase 7

Phases 0–4 ship dark (no user-visible change); Phase 5 lights it up. Each is independently revertable.
