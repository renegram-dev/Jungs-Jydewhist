# Current build summary

_Last updated: 2026-06-05._

## Production deployment
- **Stable production URL: https://renegram-dev.github.io/Jungs-Jydewhist/**
  (GitHub Pages, auto-deployed from `main` via
  [../.github/workflows/deploy.yml](../.github/workflows/deploy.yml)).
- **This is the URL to use for real play.** Open it on the iPhone and Add to
  Home Screen. The **local dev server (`npm run host`) is no longer needed for
  normal use** — only for development.
- **Data lives per origin.** For real use, keep data on the Pages URL origin so
  it persists across sessions. If any game data was entered on `localhost` or the
  LAN URL (e.g. during testing), it must be moved with **Eksportér backup → Importér
  backup** on the Pages URL — it does **not** transfer automatically.
- **CI note:** the deploy workflow logs a non-blocking *Node.js 20 actions
  deprecation* warning. It does not affect the build/deploy; bumping the action
  versions is a later cleanup (see [roadmap.md](roadmap.md)).

## Scope
A mobile-first, frontend-only **scorekeeper** for the house-rule whist variant
Jungs-Jydewhist. Four fixed players (René, Thomas, Carsten, Tom). It records
hands, computes scores from the house rules, keeps multiple saved sessions, and
supports JSON backup export/import. It is **not** a card game.

## Architecture
- **Pure scoring engine** — [../src/lib/scoring.js](../src/lib/scoring.js). No
  DOM/React/storage. 30 fixed contracts, `basePoints = 10 + 7 * rank`. Fully unit
  tested.
- **Storage / sessions** — [../src/lib/storage.js](../src/lib/storage.js). Owns
  the localStorage schema and all CRUD as pure transforms; validates imports.
- **Derived state** — [../src/state/selectors.js](../src/state/selectors.js)
  recomputes totals and display numbers from saved hands (nothing derived is
  stored).
- **React** — single source of truth in
  [../src/state/AppStateContext.jsx](../src/state/AppStateContext.jsx) (the only
  localStorage writer); presentational components in
  [../src/components/](../src/components/).

## Persistence model
- The browser/device is the source of truth. All state lives in `localStorage`
  under the key `jungs-jydewhist.v1`.
- Multiple sessions: each has id, name, created/updated timestamps, the fixed
  players, and the full hand history.
- The scoreboard is **always recomputed** from hand deltas, so totals can't drift
  and always sum to zero (a warning shows if they don't).
- On load, the most-recently-active session is restored; corrupt/empty storage
  falls back to a fresh default session.

## Known limitations
- Data is local to **one browser + one URL origin**. It is **not** synced across
  devices and may be unavailable from a different local IP/URL. Clearing browser
  data deletes it. → Use **Eksportér / Importér backup** to move data.
- Players are **fixed** in the MVP (no editing).
- Import requires the player set to be exactly René, Thomas, Carsten, Tom.
- Playwright smoke needs Chromium downloaded once (`npx playwright install chromium`).

## VIP scoring (house rule)
VIP contracts do not use the flat `10 + 7×rank` base. The declarer picks which
exchanged ("vipped") card became trump, and `vipBase = plain-number base ×
position` (1./2./3. kort = ×1/×2/×3). The hand form requires the VIP card before
saving; legacy v1 VIP hands (no stored position) keep their old delta and are
shown as "(gammel scoring)". `vipPosition` is stored on the hand and validated on
import. There's also a read-only **Scoringsregler** overview in-app.

## Validation status (this build)
- ✅ `npm test` — 50 unit tests pass (scoring incl. all worked numeric cases, the
  full VIP-by-position set + the reject-without-position case, non-zero-sum
  rejection, zero-sum property sweep; storage round-trip, VIP round-trip + legacy
  acceptance, and rejections).
- ✅ `npm run build` — production build succeeds.
- ✅ `npm run smoke` — Playwright Chromium, 3 tests: core (load → add hand → reload
  persists → undo zeroes), VIP (card required before save → scores by position),
  and Scoringsregler (overview opens with key text). **Automated path used.**
- ⏳ Manual iPhone-over-Wi-Fi pass — see
  [validation-checklist.md](validation-checklist.md); to be done on René's phone.
