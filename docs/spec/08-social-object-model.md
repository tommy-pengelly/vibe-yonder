# Vibe Yonder — Doc 8: The Social Object Model (map · yonder · post)

**How the three core social objects relate, decided against how the established activity apps do it.** This locks the data model before the feed reads are switched onto `posts` (Doc — posts foundation already built + migrated as 0013).

Doc series: 1–7 prior · **8. Social Object Model** ← here.

> **Status (decision doc).** `posts` table is live (migration 0013) with dual-write; ways-reports ship through it. This doc settles *what posts are for* and the snapshot-vs-reference rule, so the yonder/map feed-read switch is done right rather than blind.

---

## What the others do (and what it teaches us)

| App | Plan | Done (activity) | Feed unit | Completion |
|---|---|---|---|---|
| **Strava** | **Route** (separate object) | **Activity** | the *Activity itself* — it has a visibility flag and **is** the post; no separate object | a Route page lists *recent public activities* on it |
| **Komoot** | `tour_planned` | `tour_recorded` (one entity, a `type` field) | share-anything → link; **Collections** bundle tours | planned and recorded stay distinct, not auto-merged |
| **AllTrails** | **Trail** / **List** | **Activity** (recording) + **Review** | Activity / Review | **Completed list is *derived*** — auto-added when you record or review |

**Three lessons:**
1. **Strava: the activity is the feed unit.** No separate "post" table — an Activity with `visibility ≥ followers` *is* what appears in the feed. Strava can do this because it shows the activity map directly (privacy zones hide home). 
2. **The plan and the activity are always distinct objects** (Strava Route≠Activity; Komoot planned≠recorded; AllTrails Trail≠Recording). We already do this right: `maps` (plan) vs `yonders` (activity) are separate tables.
3. **Completion is derived, never stored on the shared plan** (AllTrails). A Trail isn't "completed" — *you* completed it, derived from your activities/reviews.

**Why we still need a `post`/projection where Strava doesn't:** our privacy invariant is *stronger* than Strava's — the precise `yonders.track` is owner-only and a shared yonder is an **obfuscated copy** (home zone removed, coords stripped to a 0–100 memento). RLS gates *row access*, not column *transformation*, so you can't safely expose a transformed yonder by visibility alone — you need a separate public artifact carrying the obfuscated payload. That artifact is the **post**. Strava skips it only because it exposes activities directly.

---

## The model

Three nouns, three verbs:

- **Map = what you *planned*.** A reusable set of places (Komoot Collection / Strava Route / AllTrails List). No trace. Has `visibility`. The canonical plan.
- **Yonder = what you *did*.** One attempt: precise track (owner-only), stats, Yondered, places seen. Optionally `mapId` → "an attempt at that plan." Private.
- **Post = what you chose to *show*.** The unifying feed citizen — but a *thin* one whose relationship to its source depends on whether the source is private or public:

```
MAP (plan, public-readable) ──1:many──> YONDER (attempt, private)
        │ publish                              │ share
        ▼  (REFERENCE)                         ▼  (SNAPSHOT, obfuscated)
     POST(map) ──────────── feed ──────────── POST(yonder)      POST(ways) = snapshot of many yonders
```

### The rule that decides everything: snapshot vs reference
A post projects its source into the feed. *How* depends on the source's privacy:
- **Yonder → post SNAPSHOTS.** Source is private; the post carries the obfuscated memento (no live deref ever). *Justified by privacy.*
- **Ways → post SNAPSHOTS.** Aggregate of private yonders; nothing to deref.
- **Map → post REFERENCES.** Source is *public-readable*; the post is a thin pointer (`ref_id = mapId`) and the card reads the live map. **Never stale; no duplicated places.**

> **Posts snapshot what's private, reference what's public.** One rule defines every `payload`.

### Completion is always derived
- Not on the map, not on the post. *Your* progress on a plan = derived from your yonders where `mapId = map.id` (AllTrails-style). A public map stays a clean shared plan; your ticked-off places are yours alone.
- The one thing that *can't* be derived cheaply is a **cross-user "yondered N times"** count on a public map — that needs a denormalized counter (deferred; not a per-viewer query).

### Keys (what bit us before)
- **Feed social state keys on `post.id`** (grubs, the `/yonder/[id]`-equivalent detail).
- **Owner/action keys travel in `ref_id`**: a map-post carries `mapId` for Duplicate / Load / "Continue"; a yonder-post needs no public ref (it's a snapshot). This separation keeps grubs, duplicate, and the shared-yonder detail from tangling.

---

## What this changes vs. today

Today (built): `posts` exists with dual-write; yonder posts snapshot (✓ correct); **map posts currently also snapshot** (places copied into payload); the feed still reads the legacy `shared_yonders` + public `maps` paths; ways-reports already read from posts.

To align with this doc:
1. **Map posts → references.** Stop copying places into the map-post payload; store `ref_id = mapId` (+ maybe a cached name), and have the Discover/feed map card read the live public map (places, scatter, attached-count). Removes staleness and the duplicate-on-edit problem.
2. **Switch yonder feed reads onto posts** — keying on `post.id`, updating `getSharedYonder` to resolve a *post*, and keeping `FeedMap.ref` = map id for Duplicate/Load. **Do this with a signed-in test pass** (grubs / duplicate / shared-yonder detail can't be auto-tested here).
3. **Keep maps in Discover by `visibility`** (they already work) — the map-post is only needed if we want maps *interleaved in the activity feed*; otherwise Discover can read public maps directly and posts can be yonder+ways only. **Open question below.**

---

## Open questions to settle before building

1. **Do maps belong in the activity feed at all, or only in Discover?** Strava keeps Routes *out* of the feed (they live in their own tab; the feed is activities). That argues: **feed = yonders + ways (snapshots); Discover = public maps (read directly, no post needed).** This is simpler and more honest than forcing maps into `posts`. *Recommendation: yes — drop map-posts; posts are yonder + ways only; Discover reads public maps live.* This also resolves the snapshot/reference asymmetry by removing the only "reference" case.
2. **Public attempts on a public map** (Strava's "recent activities on a route"): later, a public map page could show others' *obfuscated* yonder-posts that linked to it — a nice social loop, privacy-safe (they're already obfuscated posts).

## Done when
- Map/yonder/post roles + the snapshot-vs-reference rule are reflected in code: yonder & ways are posts (snapshots); public maps are read live in Discover; completion stays derived.
- The yonder feed read runs on `posts` (keyed on post.id), verified signed-in.
- No places duplicated into map payloads; no completion state on any shared object.
