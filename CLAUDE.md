# CLAUDE.md — Yonderful

The guide for building this app. Read it before adding anything. The build spec says *how*; this says *what it's for* and *what must never creep in*.

(Name: **Yonderful**. Formerly "Vibe Yonder" — and "Travel Yonder" before that, rejected because "travel" is generic and skews to tourism. "Yonderful" is the *wonderful local surprise* you stumble onto on foot: an independent coffee, a popup, a gig. The magic is the everyday local wander.)

> **Rebrand → "Yonderful" (done in code).** User-facing strings, metadata, manifest, splash, and `/explain` are renamed. **Internal identifiers stay `vibe-yonder` on purpose** — the localStorage/sessionStorage keys (`vibe-yonder.*`), the npm package name, and the repo directory — renaming them would orphan existing guests' saved data. Still TODO outside the code: set the real domain via `NEXT_PUBLIC_SITE_URL` (default is now `yonderful.app`, unconfirmed) and rename the Supabase project/links if desired.

---

## The point (read this first)

**Yonderful is Strava for exploring.** You pick a place, and the app points a marker straight at it — no route — and lets you find your own way there on foot. When you're done it celebrates how much you *wandered*: distance covered, places seen, how far off the straight line you strayed.

It is about **adventure, curiosity, and getting pleasantly lost.** It is not about getting there quickly or efficiently. Every feature, label, metric, and pixel should make exploring feel better. If it makes the journey more *optimal*, it's wrong.

### The litmus test
Before adding anything, ask: **"Does this make exploring more joyful, or is it optimising the journey?"**
Optimising → reject it. This single question kills most feature-bleed.

### Vibe walking (the feeling)
The mood is **eyes up, read the signs.** You don't want to *miss* anything good — an independent coffee, a quiet square, something happening — but you want to stay *free to explore*, not herded. So you navigate by what's around you, the way people once read the **constellations**: glance up, take a bearing, wander on. The app's job is to put a few points of light in your sky, not a turn list in your hand. Don't-miss-anything **and** free-to-roam — hold both. (This is why discovery is a calm *constellation* on the scope plus an on-demand *suggestions* sheet, never an interrupting feed.)

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

## Discovery & curation (the engine's taste)

The discovery engine has a **taste**, and it sends people to good, **locally-run** places to *stumble* on — never ranks by stars. (Decided 2026-06; implemented in `score()` / `lib/discovery.ts`.)

- **No ratings — ever.** Off-brand *and* not licence-cleanly free (Google ToS-blocked/paid; Foursquare = popularity). Curate by **notability** (Wikipedia/Wikidata) and **independence**, never by a score shown to the user.
- **Independent over chain — deprioritise, don't hide.** A branded/chain outlet (`brand` / `brand:wikidata`) ranks below any independent and only fills a leftover slot when nothing local is nearby. **Notability trumps the penalty:** a place with a Wikipedia entry (the Emirates, a landmark brewery) is a *notable visit*, not a chain to bury — so the penalty bites only generic, non-notable, branded everyday amenities (café/food/pub).
- **Curiosity, not a directory.** We surface things to *stumble on while wandering*; we are **not** Time Out / Yelp. The moment it becomes a browsable what's-on you scroll *before* leaving the house, we've lost it.
- **Obscure-gem flavour comes from Wikidata/Wikipedia**, not Atlas Obscura (no usable, licence-clean API). The `wikipedia` ring already surfaces the curios; lean on Wikidata typing for *weirder* picks if we want more.
- **Happenings (popups, pub quizzes, gigs) are a deferred, _community-sourced_ direction** — a venue/local posts a place + time that surfaces mid-wander (rides the social/posts layer; free and fake-proof). The discovery candidate pool is **source-agnostic**, so they slot in later with no rework. **Never** scrape commercial event APIs into a listings feed.

---

## Vocabulary (use these words, ban the others)

| Use | Not |
|---|---|
| a **yonder** (the *activity* — a walk you do/did); "to yonder", "you yondered 32×" | a walk / a run / a workout |
| a **map** (the *plan* — a saved, reusable, shareable set of places to yonder); "make a map", "yonder this map", "your maps" | a list / a collection / a route / an itinerary |
| a **mission** (the *plan* — a reusable straight-line challenge A→B with medal bands and a board); "attempt this mission", "your missions" | a challenge / a race / a level |
| **Yondered** (the wander multiplier, e.g. `32×`) | wander factor |
| a **grub** (the one-tap kudos on a shared yonder); "grub it" | like / kudos / heart (in the social feed) |
| **Direct** (straight-line start→finish) | (the idiom "as the crow flies" is fine in Explain copy only) |
| **scope** (the full-bleed view), **the dot** (you), **the marker / directional head** | minimap / radar / arrow |
| **the constellation** (the scatter of faint nearby-discovery dots on the scope) | radar / pins / map markers |
| a **sidequest** (a suggestion/detour you take mid-wander — now surfaced via the suggestions sheet; the old standalone offer card + `useSidequest` are retired) | — |
| **places seen**, **explore**, **wander**, **eyes up** | — |

**Yonder vs map vs mission (the object model — see [SCHEMA.md](SCHEMA.md) for the full law).** A **yonder** is an *outing* — you walk it; it has a trace, time, a Yondered score. A **map** and a **mission** are *plans* — reusable things you load and do: a map is a set of places, a mission is a line A→B with medal bands and a board. **The model is Strava's: the yonder (activity) is the spine, and everything hangs off it.** Doing a plan produces a yonder linked to it (`map_id` *or* `mission_id`) — so a mission attempt is just a yonder, shown in your history, re-attemptable. **Sharing is opt-in** and shares a *yonder* (the activity); plans go public via a `visibility` flag and are browsed in their Community tab, **never posted to the feed**. The feed is yonders. Read SCHEMA.md before changing any of this.

**Banned from UI and features:** pace, route, navigate, turn-by-turn, fastest, ETA, calories, elevation, climb, splits, PR, record, "efficiency".

---

## Brand

**Voice & tone.** Warm, playful, a little wry. Encourages getting lost and rewards meandering. Never naggy, never a performance coach, never corporate. Copy is short and human ("Pick a place. Walk toward the arrow.", "You yondered 32×."). Celebrate the ramble. **No em dashes anywhere in copy** (a house rule). Use a comma, a period, or restructure.

**Visual language.**
- Near-black field (`#0a0b0d`). A single **amber** accent (`#f5a623`) used *sparingly* — the directional marker and one primary action per screen. Warm-grey for secondary text. Amber is precious; don't spray it.
- **Type:** Fraunces (display — titles, place names, big stat numbers); a clean grotesk for labels/body; optional mono for live readouts. Uppercase, letter-spaced micro-labels for captions.
- **The scope is full-bleed and borderless** — no cards or boxes, ever. An **empty void**: no visible range rings at rest. Just your dot at the centre.
- The destination is a **small directional head** (a chevron/triangle — *not* an arrow, no shaft, no stalk, no line to the centre) riding on a fixed, invisible radius and rotating to point the way; distance + place name sit beneath it. When the destination is close enough to be on the canvas, it becomes a **dot** at its true position instead.
- Scale is shown by a **legible key in the bottom-right** (centre-to-ring distance) — clear enough to read at a glance, but still a key, **never by drawing rings on the void**.
- **Heading-up only.** The scope orients to the device's facing direction. (When there's no compass heading, freeze orientation and prompt a calibrate — never break.)
- **One hero, one primary action per screen.** Walk → the scope. Recap → the trace.
- **Star-map language.** The scope is a sky: discovery sits as a **constellation** of faint stars whose brightness encodes notability (bright = notable, faint = obscure gem), your course is a **dotted warm line**, and the destination is the one amber marker. The recap renders a finished yonder as a small constellation too: the dotted course threading faint stars for the places you saw. (Cool stars / warm path / violet for a lens match.)
- **Minimal motion.** No pulsing, no decorative animation, no flashy transitions. The only movement is functional: the marker rotates smoothly to the bearing, the dotted course draws in as you walk.

---

## Screens & pages (light members app)

Guest-first. Active walk is a full-screen takeover (no nav). Membership is light: an account just unlocks saving.

```
/                  Launch (home)     — the immersive "Where will you wander?" start screen, on a
                                       star-map void. The guest landing. Search a place (aliases resolve),
                                       tap a saved place, or Just wander / Maps / Missions. The centre nav
                                       mark brings you here. Starting hands off to /walk.
/community         Community         — everything outward-facing. Tabs: Following · Everyone · Maps · Missions.
/walk              Active yonder     — the launch hands off here (sessionStorage `vibe-yonder.start`).
                                       Full-bleed heading-up scope, directional head, Time + Distance
                                       (hideable), pause / finish. No nav.
/recap/[id]        Recap             — faded trace, "You yondered N×", tiles (Walked, Time, Direct,
                                       Yondered). Save, Do again, Save for later, Share.
                   (Community tabs) — Following · Everyone (the yonder feed) · Maps · Missions (public
                                       plans, browsed live by visibility — Load a map / attempt a mission).
                                       The old /explore is folded in here (/explore → /).
/explain           How it works      — the philosophy + what each metric means.
/you               Me                — profile: your yonders (history), maps, missions, places, settings.
/maps, /maps/[id]                    — a map: a saved set of places with visited / visit-again state;
                                       "Yonder this map". A map yonder produces a yonder with map_id.
/missions/[id]                       — a mission: the line A→B, medal bands, the board; "Attempt this".
                                       A mission attempt produces a yonder with mission_id (shows in history).
/favourites                          — saved places, each can start a yonder. (Surfaced as "Places" under Me.)
/u/[username]                        — public profile: your shared yonders (posts), exploration stats, follow.
/yonder/[id]                         — a shared yonder (an obfuscated post): grub, Save, Yonder this, report.
```

**Privacy invariant.** The precise `yonders.track` is owner-only — there is no public/followers read path on `yonders`. Sharing publishes an *obfuscated copy* into a **`posts`** row (home zone removed, start/finish trimmed, coordinates stripped to a 0–100 memento). You share **places + a memento, never a route**. `posts` is the *one* sharing path — there is no `shared_yonders`. Grubs are one-tap kudos on a post; there are no comments. A mission has a **board**, but it is scored by *holding the line* (deviation), never by time or speed, and it carries normalised, coordinate-free paths only. See [SCHEMA.md](SCHEMA.md).

Nav: a **Community · ⊕ · Me** three-slot bottom bar. **⊕** (centre, the brand spyglass mark) is **home → `/` the launcher** (the "let's go" start screen): the app opens here, guest-first, because the first thing you want is to start wandering, not a feed. **Community** (`/community`) is everything outward-facing — Discover (public maps + missions + yonders + search people/places) and Following. **Me** (`/you`) is everything inward — your yonders (history), maps, favourites, settings. (Earlier landings are retired; `/explore` redirects to `/community`, `/maps` + `/favourites` live under Me.) The active walk is a full takeover with no nav (the shell lives in `AppChrome`; `/walk` is the one immersive route). Member screens are built from `components/ui/` primitives (`PageScaffold`, `PageHeader`, `EmptyState`, `SegmentedTabs`, `BottomSheet`, `ListRow`) — the scope is never one of these. Auth is a **contextual sheet**, never a page; on sign-up, import the guest's local yonders.

---

## Code conventions

- **Next.js App Router + TypeScript.** Screens thin; logic in `lib/` (geo, stats — *never pace* —, rank, maps, wake). Framework-free and testable.
- **Client components** for sensors/canvas; the **scope is a `<canvas>`**.
- **Supabase** for auth + data, **Row Level Security on every table** (rows tied to `auth.uid()`). Guest data in `localStorage`, imported on sign-up. **The object model lives in [SCHEMA.md](SCHEMA.md) — read it before touching the schema, `lib/data/*`, or anything social.** The dual-mode layer (`lib/data/*`) is cloud-when-signed-in, `localStorage` otherwise; every op is async.
- **Two server routes**, both keyless, identifying User-Agent + cache:
  - `/api/geocode` — place search. Default provider **Photon** (proximity-biased, autocomplete-friendly); set `GEOCODER=nominatim` to fall back. Passes `importance` through for ranking. (We left Nominatim's *public* server because it bans search-as-you-type and commercial production traffic.)
  - `/api/place-photo` — resolves a place photo from **Wikimedia** (Wikipedia lead image, then Commons geosearch). Always returns CC attribution. Coverage is intentionally uneven — a delight when present, never required. Privacy: only call it where real coordinates are owned (recap, maps, search/selection); **never on shared content** (a post's coords are stripped on purpose).
- **Bias to free/keyless and client-side.** No new external service or paid dependency without a real reason. No map tiles in the core scope (it's an abstract trace).

---

## Future (keep on-brand if/when built)

- **Social — exploration-flavoured, not competitive.** Sharing a yonder (trace + "yondered N×"), shareable maps + missions, following friends to see where they've *discovered*, grubs on a good ramble. A mission's board is fine because it scores *holding the line* (deviation), an exploration skill — but **never** a pace/speed leaderboard or a race against the clock. **Privacy is paramount** — location is sensitive: obfuscate start points near home, sharing opt-in and granular.
- Auto-discovered POIs + Wikipedia blurbs · dead-end warnings (OSM pedestrian graph) · real map tiles under the trail · shareable recap image · offline/PWA.

---

## Never add (quick reference)

Pace · speed · calories · elevation · turn-by-turn routing · ETA · "fastest route" · performance records · signup walls · ads · streak-nagging · pulsing/decorative motion · boxes around the map · visible rings on the resting scope.

If a request seems to want one of these, re-read **The point** and apply **the litmus test** before building it.
