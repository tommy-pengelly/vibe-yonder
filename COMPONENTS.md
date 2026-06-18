# COMPONENTS.md — the design system & project shape

How the UI is built, so every screen looks and works the same. CLAUDE.md is the brand law, SCHEMA.md the data law; this is the **component law**. Read it before adding a screen or a component.

## The three layers
1. **`components/ui/` — the design system.** Presentational primitives only: props in, markup out, **no data/app logic, no data-layer imports**. Everything else composes from here.
2. **`components/layout/` — the app shell.** `AppChrome`, `BottomNav`, `BootSplash`, `PaywallProvider`. App chrome, not design-system. *(Folder move pending; today these are at `components/` root.)*
3. **Feature folders** — each owns its screen(s) + feature-specific components: `maps/`, `missions/`, `places/`, `recap/`, `profile/`, `community/`, `launch/`, `scope/` (the walk), `discovery/`, `feed/`, `account/`. *(Folder move pending; today most are flat in `components/`.)*

## The standard screen
Every member screen is composed, not hand-rolled:

```tsx
<PageScaffold>
  <PageHeader kicker="…" title="…" backHref="…" action={<IconButton …/>} />
  …content from primitives…
</PageScaffold>
```

- **`PageScaffold`** — the padded, max-width, scrollable container. Never hand-roll `flex-1 … max-w-md mx-auto px-5`.
- **`PageHeader`** — kicker + title + **history-aware back** (back returns where you came from, falls back to `backHref` on a cold open) + one `action` slot. Never hand-roll a back arrow.
- Genuinely special screens opt out by design: the **launcher** (full-bleed star map), the **walk** (immersive takeover), the **recap** (full-bleed trace). Those are the only exceptions.

## The primitives (`components/ui/`)
| Primitive | Use |
|---|---|
| `PageScaffold` / `PageHeader` | the screen shell (above) |
| `EmptyState` | empty lists (icon + title + body + optional action) |
| `Card` | the soft-bordered surface (`rounded-2xl border bg-surface`); Link / button / div |
| `BrowseCard` | a browse-list item: Card + title + meta + a `viz` slot (Maps, Missions) |
| `Tile` | a labelled stat (uppercase label + Fraunces value; `hero` variant) |
| `Chip` | a rounded-full pill: toggle or tag |
| `Button` | `variant="primary" \| "secondary" \| "ghost"` action |
| `IconButton` | a round icon button: `variant="ghost" \| "filled"` |
| `BottomSheet` | a transient sheet (vaul); centred + scrollable on desktop |
| `ListRow` | the leading · title/subtitle · trailing row (simple lists) |
| `SegmentedTabs` | the pill tab switcher |
| `viz` (`Trace`, `Traces`, `DotMap`), `MissionLineViz`, `StarField` | the canvas/SVG visuals |

## Rules (so it stays consistent — human or AI)
- **Don't hand-roll** what a primitive covers: card surfaces → `Card`; stat tiles → `Tile`; pills → `Chip`; amber/bordered buttons → `Button`; round icon buttons → `IconButton`; the screen shell → `PageScaffold` + `PageHeader`.
- **`ui/` stays pure** — no imports from `lib/data`, no business logic. If it needs data, it's a feature component, not a primitive.
- **Colours/spacing via tokens** — `var(--accent)`, `--border`, `--surface`, `--muted`, `--warm`, `--foreground`. Amber (`--accent`) is precious (CLAUDE.md): one primary action + the marker. No raw hex in components.
- **Lucide icons only**, `strokeWidth={1.75}` (or `2` for filled).
- **No em dashes in copy** (house rule).
- A new screen = `PageScaffold` + `PageHeader` + primitives. If you reach for a bespoke root div, stop and use the shell.

## Adoption status
- ✅ On the standard shell: Maps, Missions, MissionScoreboard, Favourites, Ways.
- 🔧 To migrate (bespoke → shell + primitives): MapDetail, MapEditor, ModerationView, FollowList, SharedYonderView, NotificationsView, SettingsView; align the Community + Me roots.
- ⭐ Special by design: launcher, walk, recap.
- Folder restructure (feature/ui/layout tree) is the optional last step; primitives + shell adoption come first.
