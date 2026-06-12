# DISCOVERY.md — the discovery design (source of truth)

How Yonderful surfaces things to *stumble on*. CLAUDE.md is the brand law, SCHEMA.md the data law; this is the discovery law. Read it before touching `lib/discovery*`, `lib/nearby*`, `app/api/discover`, the scope's candidate layer, or the suggestions/nudge UI.

## The point
Put **a few points of light in your sky**, never a turn list in your hand. Discovery is a calm *constellation* you read eyes-up, plus an on-demand *list*, plus a *rare* nudge for the genuinely-worth-it. Never an interrupting feed, never a directory you scroll before leaving the house. Rank by **notability + independence + proximity**, NEVER by ratings/popularity (banned, and not licence-clean).

## The algorithm
A **content-based ranker: a hand-tuned linear utility (draw − cost), surface when ≥ 0** — a gravity-model spatial term (attractiveness attenuated by distance) over a **prominence prior** (Wikidata sitelinks). It's the right class *because* the "better" mainstream algorithms (collaborative filtering, popularity ranking, learning-to-rank) need exactly the signals the brand refuses (ratings, visit-popularity, cross-user profiles). So: keep the scorer, feed it better signals. The one brand-safe personalization is **local, private, content-based** (tilt weights toward types you save) — never cross-user.

Scorer (`lib/discovery.ts`, keep): `draw = notability + guideBoost − familiarity − chainPenalty`; `cost = dist/REFERENCE + turnAround`. The change: **notability becomes continuous** (Wikidata sitelinks, log-scaled 0–1) instead of a flat 0.9 for any wiki tag — so the constellation can have bright-vs-faint stars.

## One engine, three seeds
The candidate pool is **source-agnostic**. The same `/api/discover` + scorer serves three surfaces by changing only the starting point:
1. **Your live position** → the on-walk constellation.
2. **A search / lens** ("statues", or a standing preference) → themed discovery.
3. **A map's items** → "similar suggestions" while building or viewing a map.

`/api/discover` federates **Overpass** (the independent/everyday layer, OSM tags) + **Wikidata SPARQL** (typed + notability-ranked: `wikibase:around` + direct `P31` against a curated type-QID set — NOT transitive `P279*`, which times out). Merge + dedupe by wikidata id → OSM id → coords. Keyless, cached.

## The scope: two registers
- **Going somewhere** (a committed target): the directional head **points**, distance counts down; out of range it rides the rim and points. This is the ONLY thing that points.
- **Browsing** (wandering / pulled back): a **field of true-position dots**, no pointing. Zoom the void to reach further out; the scope **widens when there's no active target** and tightens when you commit.

## The dot taxonomy
| Variable | Encodes | Values |
|---|---|---|
| **Hue** | role | amber = planned (your path) · cool grey-white = could-go · violet = matches your lens |
| **Brightness + size** | **notability** | bright/big = notable (many sitelinks) · faint/small = obscure curio |
| **Position** | where it is | true relative position; only *planned* targets point from the rim when far |
| **Fill** | progress | solid = live · hollow/ticked = seen |

Notability-brightness lives in the **discovery (cool) layer**; the amber path is always full-strength — it's *yours*, not ranked. The result is a literal constellation: a few bright stars (notable), a scatter of faint ones (obscure gems, never hidden, just quiet), the warm route through the middle. No pulsing; the only motion is a gentle fade-in and the heading-up sweep.

## The surfaces
- **Constellation** (scope) — ambient, eyes-up. Tap a dot → the blurb sheet.
- **Blurb sheet** — entity-accurate photo (`PlacePhoto` `wiki` prop) + 1–2 line Wikipedia blurb + type + distance; actions: head here · save · dismiss.
- **"Around you" list** — a scrollable, notability·proximity-ranked list (also "top 10 nearby"); the zoom-independent way in.
- **The nudge** — a rare, **notability-gated**, dismissible chip for genuinely-worth-it finds only (high sitelinks, close, unseen). Throttled; never a feed. The revived sidequest.
- **Map "similar"** — seeded by a map's items; in the editor ("more like these") and on a map's page ("similar nearby"); tap to add.

## Guardrails
- No ratings/popularity/quality scores, ever. Notability + independence + proximity only.
- Never an interrupting feed; the nudge is rare and silenceable.
- Discovery never points; only committed targets do.
- Privacy: discovery reads are about *where you are*, not who you are; no cross-user signals; photo/blurb only on owned coordinates (never shared content).
- Gated behind `DISCOVERY_ENABLED` (lib/flags.ts) until field-tested.
