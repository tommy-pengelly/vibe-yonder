# Vibe Yonder — Doc 1: Solo MVP

**The complete solo experience:** landing → create a yonder → do the whole thing → recap. No account, no saving to the cloud, no social (those are Docs 2–4). Read with **CLAUDE.md** for the why/brand/guardrails (no pace, no routing, exploration over efficiency).

Doc series: **1. Solo MVP** ← here · 2. Account & History · 3. Community · 4. Social.

---

## Design tokens (so visuals don't drift)

- **Colour:** bg `#0a0a0a`; surface `#14161a`; **amber** `#f5a623` (the marker + one primary action per screen); text `#f2efe6`; muted `#8a8a82`; visited/confirm = amber check (no separate green).
- **Type:** Fraunces (display: titles, place names, big stat numbers) · a clean grotesk (UI/labels/body) · optional mono (live readouts). Captions = uppercase, letter-spaced, ~11px muted.
- **Shape:** borderless; pills fully rounded; the rare card ~16px radius. No shadows except the soft glow on the you-dot and marker.
- **Motion:** functional only — marker rotates smoothly to bearing, trail draws in. No pulsing/decoration.
- **Amber is precious** — don't spray it.

---

## 1. Landing / Explore (`/`)

Guest entry, one tap in. Title **"Where to?"**, sub "Pick a place. Walk toward the arrow." A prominent **search** field and a **"New list →"**/multi-place entry. Searching → ranked results (distance label, nearest-prominent first) → selecting one starts a single-destination yonder. Building multiple → the create flow below.

*State:* empty (just search + prompt); typing (debounced "Searching…"); results; no-results ("No matches — try adding the town").
*Done when:* a place can be searched and selected, and selecting one lands you on the active yonder.

---

## 2. Create a yonder — three types

One create surface, three shapes:

- **Single destination** — search, pick one place, **Start**. (The fast path.)
- **Collection (cluster) — default for multi.** Add several places, **no order**. You'll wander between them freely.
- **Ordered (sequence)** — add several places in a set order; the yonder steps through them.

UI: a place row list with **"Add a place"** (search → append). A simple **type control** — Single is implicit when there's one place; with 2+ places, choose **Collection** (default) or **Ordered**. Ordered shows drag/▲▼ reordering; Collection hides it. **Start** commences.

*State:* 0 places (prompt to add); 1 place (Single); 2+ (Collection/Ordered toggle visible).
*Done when:* you can assemble 1+ places, pick Collection/Ordered for multi, and Start a yonder carrying those targets + mode.

---

## 3. The active yonder (`/walk`) — the core experience

Full-bleed, borderless, **heading-up** scope. You are the **dot at the centre**; the world rotates to your facing direction.

### The canvas
- **Radial fade.** Content fades radially toward the edge — a soft circular vignette, no hard border. The void is empty at rest (no rings).
- **Targets render by position:**
  - **Inside the visible circle → a sharp dot** at its true position (scaled by zoom). As a dot nears the edge it **fades radially**.
  - **Outside the circle → a faded directional head** (chevron/triangle, no shaft/stalk/line) pinned at the rim, pointing the bearing.
- **Active vs ghosts:** the current target is **amber and full-strength** (its head/dot + distance + name). Other unvisited targets are **ghosts** — faint heads/dots, closer = slightly stronger. (Collection shows all unvisited as ghosts; Ordered shows the active waypoint bold + the rest faint, with "Waypoint n of N".)

### Scale & zoom
- **Pinch-zoom + drag-pan.** Adjusts metres-per-pixel (clamp sensible min/max).
- **Subtle scale key, bottom-right** — centre-to-rim distance, **default 100 m** (`●——│ 100 m`), muted. Updates on zoom, **snapping to round numbers** (50 m / 100 m / 250 m / 500 m / 1 km / 2 km…). No rings drawn — the key is the only scale cue.

### Arrival → "visited"
- Coming within **~25 m** of an **unvisited** target triggers a **popup once**: "You're at **{name}** — Visited?" with **Visited ✓** / **Not yet**. (Confirm, not silent auto — GPS is fuzzy.)
- On **Visited:** the place marks visited, its marker checks off and disappears from the scope; **Collection** drops that ghost; **Ordered** advances to the next waypoint.

### Keep wandering, finish when done
- Finishing is **always available** (it's not gated on visiting anything).
- When **all targets are visited**, don't auto-end — show a quiet line: **"All places visited — keep wandering, or finish whenever."** The user continues or taps Finish at will.

### Add a destination mid-yonder
- An **"+ Add place"** affordance in the HUD opens search and **appends a new target** to the live yonder (appears as a ghost). Single → becomes a small Collection; Ordered → appended to the sequence. No interruption to tracking.

### HUD & controls
- **Top:** active destination name (+ "Waypoint n of N" for Ordered).
- **Bottom strip:** **Time · Distance** (these will become hideable via a setting in Doc 2). **Pause** (circular) + a **modest Finish** + **"Just take me there ↗"** (deep-link to a real maps app for the active target). **Discard lives inside pause** (Resume / Discard) — no top Cancel.
- **Wake lock** held while active; track recording throttled (>3 m / >3 s), paused when paused.

### States
- **Acquiring GPS:** dimmer you-dot + quiet "Searching for signal…" (no pulse).
- **No compass heading:** freeze orientation + "Point your phone to set direction"; never break.
- **Poor accuracy:** tiny muted "±NN m"; no red banner.

*Done when:* on a real phone outdoors, the scope orients heading-up; targets show as sharp in-circle dots / faded rim heads; the active target is amber and ghosts are faint; pinch-zoom rescales and the key snaps; arriving at a target fires the visited popup and updates the targets; you can add a place mid-yonder; Finish is always available and "all visited" doesn't force an end.

---

## 4. Recap (`/recap`) — the complete screen

Faded full-bleed **trace** (same radial treatment); hero **"You yondered N×"**; tiles **WALKED · TIME · DIRECT · YONDERED** (Yondered largest). Auto-named, editable. Actions: **New walk**, and a **"Save locally"** (guest keeps it in `localStorage`; cloud save + history is Doc 2). A **"What do these stats mean?"** link → Explain.

*Done when:* finishing a yonder shows the trace, the four stats computed correctly (Yondered = Walked ÷ Direct), and "New walk" resets cleanly; "Save locally" persists for the guest.

---

## Out of scope for Doc 1 (later docs)
Accounts/auth, cloud history, **saving lists for reuse** & partial-completion across sessions, "do again"/"save for later", the **hide-numbers** setting, sharing, community, social, profiles. Doc 1 is: land → build a yonder → do it → see the recap, all as a guest.

---

## Acceptance summary (Doc 1 is "done" when…)
A guest can, on a phone: search a place and start a single-destination yonder; or assemble a Collection/Ordered yonder; walk it with a heading-up scope (dots inside the faded circle, rim heads outside, ghosts for other targets); pinch-zoom with a snapping scale key; get a "visited" popup on arrival that updates targets; add a destination mid-yonder; keep wandering after all are visited; Finish; and see a correct recap they can save locally — with graceful no-GPS / no-compass states throughout.
