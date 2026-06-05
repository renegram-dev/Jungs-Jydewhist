# SKILLS.md — repo workflows

Lightweight playbooks for the recurring kinds of change in this repo. Each lists
the files usually involved and the checks that must pass.

## 1. Scoring-engine changes
Change how points are calculated or which contracts exist.
- **Files:** [src/lib/scoring.js](src/lib/scoring.js),
  [src/test/scoring.test.js](src/test/scoring.test.js)
- **Rule:** update the tests FIRST (red), then the engine (green).
- **Checks:** `npm test`. Every delta must stay zero-sum (there is a property
  test for this). Keep the contract order/ids stable.

## 2. Storage / session changes
Change the persisted schema, session CRUD, or load/save behaviour.
- **Files:** [src/lib/storage.js](src/lib/storage.js),
  [src/state/AppStateContext.jsx](src/state/AppStateContext.jsx),
  [src/state/selectors.js](src/state/selectors.js),
  [src/test/storage.test.js](src/test/storage.test.js)
- **Checks:** `npm test`. If the schema changes, bump the storage key/version and
  keep `loadAppState` tolerant of old/corrupt data (it must never throw).

## 3. UI changes
Change screens, forms, layout, Danish copy.
- **Files:** [src/components/](src/components/), [src/App.jsx](src/App.jsx),
  [src/index.css](src/index.css)
- **Checks:** `npm run build`, then `npm run smoke` (or the manual steps in
  [docs/browser-smoke-manual.md](docs/browser-smoke-manual.md)) and a manual
  iPhone pass. Keep touch targets ≥ 48px and inputs ≥ 16px (no iOS auto-zoom).

## 4. Backup / import-export changes
Change export JSON, import validation, or "Kopiér score".
- **Files:** [src/lib/storage.js](src/lib/storage.js) (`exportAppState` /
  `importAppState`), [src/components/ImportDialog.jsx](src/components/ImportDialog.jsx),
  [src/state/report.js](src/state/report.js),
  [src/test/storage.test.js](src/test/storage.test.js)
- **Rule:** imports are **validated** and added as a **new** session — never
  overwrite. Players must match the fixed four or the import is rejected.
- **Checks:** `npm test` (round-trip + rejection cases).

## 5. Browser smoke validation
Confirm the running app works end-to-end.
- **Files:** [e2e/smoke.spec.js](e2e/smoke.spec.js),
  [playwright.config.js](playwright.config.js)
- **Run:** `npm run smoke` (needs Chromium: `npx playwright install chromium`).
  If Playwright is unavailable, follow
  [docs/browser-smoke-manual.md](docs/browser-smoke-manual.md).
