# CLAUDE.md — Vibe Yonder

The guide for building this app. Read it before adding anything. The build spec says *how*; this says *what it's for* and *what must never creep in*.

(Name: **Vibe Yonder**. We considered "Travel Yonder" and rejected it — "travel" is generic and skews toward tourism; the magic is the everyday local wander.)

---

## The point (read this first)

**Vibe Yonder is Strava for exploring.** You pick a place, and the app points a marker straight at it — no route — and lets you find your own way there on foot. When you're done it celebrates how much you *wandered*: distance covered, places seen, how far off the straight line you strayed.

It is about **adventure, curiosity, and getting pleasantly lost.** It is not about getting there quickly or efficiently. Every feature, label, metric, and pixel should make exploring feel better. If it makes the journey more *optimal*, it's wrong.

### The litmus test
Before adding anything, ask: **"Does this make exploring more joyful, or is it optimising the journey?"**
Optimising → reject it. This single question kills most feature-bleed.

---

## What it is NOT (guardrails — this is where drift happens)

- **Not a navigation app.** No turn-by-turn, no routing, no "fastest way", no ETA, no rerouting. The marker points as the crow flies; the streets are the user's choice. The "Just take me there" link hands off to a real maps app on purpose — that's the *only* routing, and it's an exit, not a feature.
- **Not a fitness tracker.** We are not measuring performance. We track distance, time, and *Yondered* because they tell an **exploration** story — not a workout one.
- **NO PACE. EVER.** Pace is a performance metric; it has no place here. Same for speed, calories, splits, personal records, "faster than last time." Delete on sight.
- **No elevation.** Can't be measured reliably on the web *and* it's a fitness metric anyway. Don't add it.
- **Detours, loops, and dead-ends are features, not failures.** A high Yondered score is a *brag*, never inefficiency to reduce.
- **No signup wall.** Guest-first, always. Auth only appears when someone wants to *save* something.
- **No ads, no engagement-bait, no streak-nagging.** A calm tool for getting lost, not a dopamine loop.

### The numbers are optional
Metrics serve the story; they are not the point. The app offers a **"hide the numbers"** setting that removes live distances, time, and distance-travelled, leaving just you, the directional marker, and the place name. Treat measurement as something the user can switch off entirely — that's the spirit. Never make a number feel mandatory or central.

---

## Vocabulary (use these words, ban the others)

| Use | Not |
|---|---|
| a **yonder** (the *activity* — a walk you do/did); "to yonder", "you yondered 32×" | a walk / a run / a workout |
| a **map** (the *plan* — a saved, reusable, shareable set of places to yonder); "make a map", "yonder this map", "your maps" | a list / a collection / a route / an itinerary |
| **Yondered** (the wander multiplier, e.g. `32×`) | wander factor |
| **Direct** (straight-line start→finish) | (the idiom "as the crow flies" is fine in Explain copy only) |
| **scope** (the full-bleed view), **the dot** (you), **the marker / directional head** | minimap / radar / arrow |
| **places seen**, **explore**, **wander** | — |

**A yonder vs a map.** A **yonder** is an *outing* — you walk it; it has a trace, time, and a Yondered score. A **map** is a *plan* — a curated set of places, no trace, that you can yonder anytime, do again, keep for later, or (Doc 3) share publicly so others **Load / Duplicate** its places and wander their own way. The two are separate objects (the `yonders` table = activities; the `maps` table = plans).

**Banned from UI and features:** pace, route, navigate, turn-by-turn, fastest, ETA, calories, elevation, climb, splits, PR, record, "efficiency".

---

## Brand

**Voice & tone.** Warm, playful, a little wry. Encourages getting lost and rewards meandering. Never naggy, never a performance coach, never corporate. Copy is short and human ("Pick a place. Walk toward the arrow.", "You yondered 32×."). Celebrate the ramble.

**Visual language.**
- Near-black field (`#0a0b0d`). A single **amber** accent (`#f5a623`) used *sparingly* — the directional marker and one primary action per screen. Warm-grey for secondary text. Amber is precious; don't spray it.
- **Type:** Fraunces (display — titles, place names, big stat numbers); a clean grotesk for labels/body; optional mono for live readouts. Uppercase, letter-spaced micro-labels for captions.
- **The scope is full-bleed and borderless** — no cards or boxes, ever. An **empty void**: no visible range rings at rest. Just your dot at the centre.
- The destination is a **small directional head** (a chevron/triangle — *not* an arrow, no shaft, no stalk, no line to the centre) riding on a fixed, invisible radius and rotating to point the way; distance + place name sit beneath it. When the destination is close enough to be on the canvas, it becomes a **dot** at its true position instead.
- Scale is shown only by a **very subtle key in the bottom-right** (centre-to-ring distance, default 100 m), never by drawing rings on the void.
- **Heading-up only.** The scope orients to the device's facing direction. (When there's no compass heading, freeze orientation and prompt a calibrate — never break.)
- **One hero, one primary action per screen.** Walk → the scope. Recap → the trace.
- **Minimal motion.** No pulsing, no decorative animation, no flashy transitions. The only movement is functional: the marker rotates smoothly to the bearing, the trail draws in as you walk.

---

## Screens & pages (light members app)

Guest-first. Active walk is a full-screen takeover (no nav). Membership is light: an account just unlocks saving.

```
/                  Feed             — Mine · Following · Community. Your wanders + (Doc 3) people you
                                       follow + public discovery. The guest landing.
/walk              Active yonder     — launched by the ⊕. Full-bleed heading-up scope, directional head,
                                       Time + Distance (hideable), pause / finish. Full takeover, no nav.
/recap/[id]        Recap             — faded trace, "You yondered N×", tiles (Walked, Time, Direct,
                                       Yondered). Save, Do again, Save for later, Share.
/explain           How it works      — the philosophy + what each metric means.
/you               Me                — profile: your yonders, maps, favourites, saved, settings, sign in/out.
/maps, /maps/[id]                    — a map: a saved set of places with visited / visit-again state;
                                       "Yonder this map".
/favourites                          — saved places, each can start a yonder.
/saved                               — save-for-later bookmarks; tap to yonder.
```

Nav: a **Feed · ⊕ · Me** bottom bar (Strava-shaped; the centre ⊕ launches a yonder). The active walk is a full takeover with no nav. Auth is a **contextual sheet**, never a page; on sign-up, import the guest's local yonders.

---

## Code conventions

- **Next.js App Router + TypeScript.** Screens thin; logic in `lib/` (geo, stats — *never pace* —, rank, maps, wake). Framework-free and testable.
- **Client components** for sensors/canvas; the **scope is a `<canvas>`**.
- **Supabase** for auth + data, **Row Level Security on every table** (rows tied to `auth.uid()`). Guest data in `localStorage`, imported on sign-up.
- **One server route** (`/api/geocode`) — proxies Nominatim with an identifying User-Agent + cache; passes `importance` through for ranking.
- **Bias to free/keyless and client-side.** No new external service or paid dependency without a real reason. No map tiles in the core scope (it's an abstract trace).

---

## Future (keep on-brand if/when built)

- **Social (phase 2) — exploration-flavoured, not competitive.** Sharing a yonder (trace + "yondered N×"), shareable/collaborative maps, following friends to see where they've *discovered*, kudos on a good ramble. **Never** pace/speed leaderboards or racing. **Privacy is paramount** — location is sensitive: obfuscate start points near home, sharing opt-in and granular. Build only after the solo loop is loved; social amplifies a good core, it can't create one.
- Auto-discovered POIs + Wikipedia blurbs · dead-end warnings (OSM pedestrian graph) · real map tiles under the trail · shareable recap image · offline/PWA.

---

## Never add (quick reference)

Pace · speed · calories · elevation · turn-by-turn routing · ETA · "fastest route" · performance records · signup walls · ads · streak-nagging · pulsing/decorative motion · boxes around the map · visible rings on the resting scope.

If a request seems to want one of these, re-read **The point** and apply **the litmus test** before building it.
