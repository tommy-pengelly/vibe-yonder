# Vibe Yonder — Doc 7: Ambient Discovery (the draw-vs-cost engine)

**One engine that decides what's worth wandering toward — and surfaces it four ways.** Where Doc 6 added the *plumbing* (`/api/nearby`, category search, sidequests), this adds the *brain*: a single scoring function that ranks real-world places by how much they should pull you, against what reaching them asks of you. Ambient mode ("just yonder — show me what's around") falls out of it; the surfaces Doc 6 already built (sidequests, category search) become smarter for free.

> **Working codename "the radar" is internal only.** The UI never says *radar* (banned vocabulary — and the scope is an empty void, no sweep, no rings at rest). On screen this is the scope quietly showing a candidate **dot** or two; in code it's the discovery engine.

Two rules that keep it on-brand (from CLAUDE.md): **curiosity, never utility** — ambient discovery points you at *something to find*, never the best-rated nearest amenity; and **the numbers/ratings are not the point** — we rank by *interestingness*, never by quality scores or popularity (which are also neither free nor licence-clean — see Non-goals).

Doc series: 1–6 prior · **7. Ambient Discovery** ← here. Depends on Doc 6 Part A (`/api/nearby`) and the Doc 5 walk engine (sensors, track, Scope, add-place seam).

> **Status (planned).** New primitive lives in `lib/discovery.ts` (the `score()` function) + `lib/geo.ts` (the bearing/confidence estimator); ambient mode is a new ⊕ launch path reusing the planned Clue-Hunt reveal, the Tour/Wikimedia blurb plumbing, and `/api/place-photo`. Reveal-on-approach is licence-clean here: ambient coords are the user's own live location (real, owned), so the photo lookup is allowed — unlike shared yonders, whose coords are stripped (Doc 3).

---

## Part A — the core: draw ≥ cost

Every candidate node carries a **draw** (how much it should pull you) weighed against a **cost** (what reaching it asks). Surface it only when **draw ≥ cost**. Everything in this doc is a term on one side or the other of that one inequality — that's why four surfaces share one function.

```
draw(node)  = notability(node) + guideBoost(node, activeGuide)
cost(node)  = distance(node) + directionPenalty(node, travelBearing, confidence)
surface ⟺ draw ≥ cost
```

`score(node, ctx)` lives in `lib/discovery.ts` — pure, sensor-free, unit-testable. `ctx = { origin, activeGuide, travelBearing, confidence, ledger }`.

### Notability (free, on-brand signals only)

Not "is it good" — *"is there a story here."* All from data we already touch:
- **`wikipedia` / `wikidata` tag on the OSM element** → high. (Also the reveal content — see Part D.)
- **Photon `importance`** → already passed through ([[external-apis]]).
- **`tourism` / `historic` / `leisure` tag** → medium.
- **plain named amenity** (a café with just a name) → low.

---

## Part B — the distance gate (ring tiers)

*Near can be ordinary; far must be notable.* The notability bar **rises with distance**, which is what keeps the void uncluttered. Implemented not as a spiral/index but as a **multi-ring Overpass union** — one clause per ring with a stricter filter and a per-ring cap, log-spaced radii:

| Ring | Radius (default) | What qualifies | Cap |
|---|---|---|---|
| 0 | 0–400 m | anything in the active categories | ~4 |
| 1 | 400 m–1.2 km | only *interesting* — `tourism`/`historic`/`viewpoint`/`park` | ~3 |
| 2 | 1.2–3 km | only *notable* — has `wikipedia`/`wikidata` | ~2 |

This is a small edit to the query builder in `app/api/nearby/route.ts` (one `around:` clause per ring rather than one flat radius). The route's existing "near handful + a few from further out" ordering is the seed of this — formalise it into rings.

**Void hygiene:** cap on-canvas candidates hard (≤6) and keep most **unrevealed** (faint, nameless) so the void still breathes. The gate naturally enforces sparsity; don't fight it with a pin cloud.

---

## Part C — direction & guides

### Directional penalty — "it has to be really good to turn around for"

A node *behind* your line of travel costs more to reach, so it needs more draw to clear the bar. Keyed off your **direction of travel** (reversing your path), not compass facing (where your gaze points). The penalty scales with the angular offset from `travelBearing`, and — crucially — with **confidence**:

- **High confidence** (marching a straight line) → bias hard; behind-you nodes need to be exceptional.
- **Low confidence** (weaving, doubling back, stopped) → relax the bias; open to all directions.

That second behaviour is on-brand by construction: *a wanderer who's weaving is exploring, so the engine opens up; one who's marching has a clear front, so respect the momentum.*

### The bearing/confidence estimator (`lib/geo.ts`)

A new stateful estimator, **distinct from `makeAngleSmoother()`** (which only unwraps angles for CSS rotation). Bearings wrap at 360°, so we can't average them as scalars — average the heading **unit-vectors** instead. One EMA on `(cos θ, sin θ)` gives both signals at once:

- its **angle** (`atan2`) = smoothed `travelBearing` → the penalty reference,
- its **resultant length** (0→1) = `confidence` → how consistent the heading's been → scales the bias. `R≈1` locked-in line; `R≈0` churn.

(A short-vs-long EMA crossover — the "market signal / trend" framing — is the equivalent two-window form; the single resultant-length version needs no second window to tune. Either is fine; the length version is the default.)

**Weight each step by distance moved, not sample count** — a cluster of jittery standstill fixes has garbage bearings and must contribute nothing. At a standstill, confidence → 0 and cost gracefully falls back to the pure distance gate (the "never break, degrade" rule). Fallback order for `travelBearing`: track-derived → compass heading (if still) → none (distance gate only).

### Guides (themes) — a lens you hold up, then lower

A guide ("coffee", "food", "history") is a **session lens you toggle on and off mid-wander**, not a stored preference (matches "mood per session" — dies with the session, nothing learned, nothing tracked). It adds `guideBoost` to draw for matching categories so they clear the bar more eagerly, even slightly off your path.

- **It leans, it never blinds.** The boost is *modest* — non-matching nodes are penalised, never zeroed. A genuinely notable cathedral still pierces your coffee guide (that's the magic moment). Zeroing everything else = a nearest-amenity finder = Google Maps = banned.
- On/off is a per-session toggle, sibling to the sidequest toggle.

---

## Part D — reveal-on-approach (the payoff)

In ambient mode you **don't see what a dot is until you're close.** A faint, nameless candidate dot resolves — within a reveal radius — into name + Wikipedia blurb + photo. Curiosity, withheld then rewarded. Reuses three things already built/planned:

- the **Clue Hunt** reveal mechanic (marker hidden until arrival),
- the **Tour** Wikipedia-blurb plumbing (Wikimedia, already wired),
- **`/api/place-photo`** for the image (licence-clean here — owned live coords).

Keep it sparse: fewer, better dots. A screen of identical faint dots is disorienting; one mystery that resolves as you close in is magic.

---

## Part E — seen & skipped (familiarity)

The engine must not re-offer what you've already done or just waved off. This is **one more term subtracted from draw**, not a new system — a **familiarity penalty** from a local ledger:

- **Seen** (visited / revealed): large, long-lived penalty — you know what it is now, so it drops out of *mystery* surfacing (it may still appear as a recognised landmark). Feeds naturally into the recap's "places seen" (Doc 6).
- **Skipped** (surfaced then declined / passed by): **decay, not blacklist.** A moderate penalty that **decays with distance travelled since** the skip (displacement-based cooldown, same instinct as the bearing weighting) — so the café you just walked past won't nag, but it can resurface on a later wander or if you loop back and nothing better is around. Permanent blacklisting would be off-brand: *detours, loops and dead-ends are features* — you might want it later.

**Identity:** carry the stable OSM `type/id` through `/api/nearby` (add `id` to `NearbyPlace`); fall back to a rounded-coord hash for non-OSM nodes.

**Storage (guest-first, owner-only, never shared):** a bounded `localStorage` ledger `vibe-yonder.discovery.v1` — `{ id, status: "seen"|"skipped", at, distTravelledAt }`, capped with oldest-evicted. This is a trail of *what interested you and where* — sensitive — so it **stays on device by default and never appears in shared yonders** (Doc 3 privacy invariant). Optional owner-only sync later; not required to ship.

---

## The four surfaces (one function, different default weights)

| Surface | Weights | Status |
|---|---|---|
| **Ambient** ("just yonder") | full draw-vs-cost; reveal-on-approach; ledger active | **new** (this doc) |
| **Single aim** | engine picks the top-scoring node; you commit | small new launch path |
| **Sidequest** | one node, mid-walk, high cost bar (must be worth the detour) | ✅ Doc 6 — rescore via `score()` |
| **On-request** ("find me coffee") | guide forced on; reveal off (you asked, so you know) | ✅ Doc 6 — rescore via `score()` |

---

## Data / migrations

- **No DB migration.** `lib/discovery.ts` (`score()`), `lib/geo.ts` (bearing/confidence estimator), the ring-tier query edit in `app/api/nearby/route.ts`, and the `localStorage` ledger. `NearbyPlace` gains `id` + optional `wiki`/`importance`/`tags` for scoring.
- RLS unchanged; the ledger is client-side and never published.

---

## Non-goals (the brand-drift guardrails)

- **No quality ratings, ever.** Not stars, not popularity, not "best nearby." Off-brand (kills curiosity) *and* not freely/licence-cleanly available: Google Places ratings can't be stored/shown off a Google map and are paid; Foursquare imports a popularity metric we don't want anyway; OSM has none. We rank by *notability* (there's a story), not *quality* (it's rated highly).
- **Never a fastest-route-to-the-best-café finder.** Guides lean, never blind; ambient mode withholds the destination on purpose.
- **No naggy resurfacing.** Skipped decays gently; the sidequest non-naggy contract (one at a time, cooldown, dismiss sticks, no pulsing) holds.
- **No new external service.** Everything keyless/free (Overpass + Wikimedia, both already in use); no ratings API, no map tiles.

---

## Done when

- `score(node, ctx)` in `lib/discovery.ts` ranks candidates by draw-vs-cost; unit-tested across distance/direction/guide/ledger permutations.
- `/api/nearby` returns ring-tiered candidates (near=any, far=notable) with stable `id` + scoring tags.
- The `lib/geo.ts` estimator yields a smoothed `travelBearing` + `confidence`, displacement-weighted, degrading to the distance gate at a standstill.
- Ambient mode launches from ⊕, shows ≤6 sparse candidate dots (most unrevealed), and reveals name + blurb + photo on approach.
- Guides toggle on/off mid-wander and lean (not blind) the engine; sidequests + category search are rescored through `score()`.
- Seen drops from mystery surfacing; skipped decays with distance travelled; ledger is bounded, on-device, never shared.
- `tsc` / `eslint` / `next build` green.
```
