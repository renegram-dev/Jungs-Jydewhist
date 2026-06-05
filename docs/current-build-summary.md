# Current build summary

_Last updated: 2026-06-05 (initial build)._

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

## Validation status (this build)
- ✅ `npm test` — 36 unit tests pass (scoring incl. all 9 worked numeric cases +
  the non-zero-sum rejection, zero-sum property check, storage round-trip &
  rejections).
- ✅ `npm run build` — production build succeeds.
- ✅ `npm run smoke` — Playwright Chromium: load → add hand (René 7 w/ Thomas, 7
  tricks → ±10) → reload persists → undo zeroes totals. **Automated path used.**
- ⏳ Manual iPhone-over-Wi-Fi pass — see
  [validation-checklist.md](validation-checklist.md); to be done on René's phone.
