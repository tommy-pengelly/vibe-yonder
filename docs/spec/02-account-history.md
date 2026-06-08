# Vibe Yonder — Doc 2: Account & History

**Everything about *you* persisting.** Builds on Doc 1 (the solo guest loop) by adding accounts and saved data: your yonders history, favourites, reusable lists with partial-completion across sessions, "do again" / "save for later", and the hide-numbers setting. No sharing or social yet — that's Doc 3.

Read with **CLAUDE.md** (brand/guardrails) and **Doc 1** (the solo UX this extends). Doc series: 1. Solo MVP · **2. Account & History** ← here · 3. Community & Social.

---

## Auth & the guest → account bridge

- **Guest-first stays true.** The Doc 1 loop (land → yonder → recap) keeps working signed-out, with recents in `localStorage`.
- **Auth is a contextual sheet**, never a launch wall. It appears only when the user tries to **save to their account**, keep a list, or favourite a place — "Create a free account to keep this."
- **Method:** Supabase **magic-link (passwordless email)** as the primary path (simplest, no passwords); offer **Apple / Google** sign-in as optional one-tap (nice on a phone web app). Decide based on effort — magic link alone is enough to ship.
- **On sign-up, import the guest's local yonders** into their account, then clear local. Nothing is lost.

*State:* signed-out (features that need an account show a small "Sign in to save" CTA, never a block); signing-in (sheet); signed-in.
*Done when:* a guest can use everything from Doc 1; the moment they save/favourite/keep-a-list, the sheet offers sign-in; after sign-up their local yonders appear in their history.

---

## Data model (Supabase, RLS on every table)

```sql
profiles(id → auth.users, display_name, created_at)
places(id, user_id, name, lat, lon, created_at)                         -- favourites
lists(id, user_id, name, mode 'single'|'collection'|'ordered',
      created_at)                                                        -- visibility added in Doc 3
list_items(id, list_id, name, lat, lon, position,
           visited bool default false, visited_at, created_at)
yonders(id, user_id, name, started_at, ended_at, duration_s,
        distance_m, direct_m, yondered, track jsonb, created_at)         -- no pace, no elevation
saved(id, user_id, kind 'place'|'list', ref_id, created_at)              -- "save for later"
settings(user_id PK, hide_numbers bool default false)                    -- or a column on profiles
```
**RLS:** every row tied to `auth.uid()` (own read/write only). Guest data lives in `localStorage` and is imported on sign-up.

---

## Screens

### You (`/you`)
Your hub: a profile preview, your **History** (recent yonders), and entries to **Lists**, **Favourites**, **Settings**, and **sign out**. Signed-out shows a sign-in CTA.

### Settings (`/you/settings`)
- **Hide the numbers** (the toggle deferred from Doc 1): when on, the **live walk** hides location distances, **time**, and **distance travelled** — leaving the marker, place name, and controls (and optionally the scale key). Persisted. **Recap is unaffected.**
- Account: email, sign out, delete account.

*Done when:* toggling hide-numbers removes those live readouts on the next walk and persists across sessions; recap still shows them.

### History — your yonders
A feed of saved yonders as cards: name, small trace thumbnail, **yondered N×**, date, distance. Tap → opens that recap. Each card offers **Do again** and **Save for later**.

*State:* empty ("No yonders yet — go wander"); list of cards; loading skeleton.
*Done when:* finished+saved yonders appear here, open their recap, and offer do-again / save-for-later.

### Favourites (`/favourites`)
Saved places. Each can **start a yonder** directly or be **added to a list**.

### Lists (`/lists`, `/lists/new`, `/lists/[id]`)
Saved, reusable versions of the Doc 1 create flow.
- **Create** (`/lists/new`): name → mode (**Collection** default / **Ordered**) → add places via search. (A single place is just a quick yonder, not a saved list.)
- **Detail** (`/lists/[id]`): the places with **persistent visited state** (unvisited / visited / **visit again**), the mode, and **"Yonder this list"**.
- **Partial completion & resume (the key feature):** visited state **persists across sessions**. Do part of a list today; reopen it tomorrow and **only the remaining places show as active** (visited ones collapse under "Seen (n)"); **"visit again"** resurfaces one. Yondering the list picks up where you left off.

*State:* empty ("No lists yet"); a list mid-completion (remaining + a "Seen" fold); fully complete ("All seen — visit again?").
*Done when:* a list's visited marks survive a refresh/relaunch; resuming shows remaining first; "visit again" reactivates a place.

### Recap (updated from Doc 1)
Now **Save** writes to the account (named, appears in History) instead of only local. Plus **Do again** (start a fresh yonder to the same target[s]) and **Save for later** (store the target[s] in `saved` to do another time).

---

## "Do again" vs "Save for later"
- **Do again** — immediately start a new yonder to the same destination(s)/list. Re-wander it.
- **Save for later** — bookmark the destination(s)/list (into `saved` / favourites) to do in future, without starting now.

Both live on the Recap and on History cards.

---

## Out of scope for Doc 2 (→ Doc 3)
Sharing yonders, making lists/yonders public or searchable, profiles others can see, following, feeds, grubs, "save *someone else's* yonder", privacy zones & trace obfuscation, moderation. Doc 2 is entirely *your own* data, private to you.

---

## Acceptance summary (Doc 2 is "done" when…)
A user can sign in via a contextual sheet (magic link), keep their guest yonders, and see them in History; favourite places; build and save Collection/Ordered lists; yonder a list and have **partial completion persist across sessions** (resume remaining, "visit again"); toggle **hide-numbers** to strip live readouts; and from any recap or history card **do it again** or **save it for later** — all private to their account, with graceful signed-out and empty states.
