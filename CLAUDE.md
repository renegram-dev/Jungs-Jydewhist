# CLAUDE.md — working rules for Jungs-Jydewhist

Concise instructions for anyone (human or AI) working in this repo.

## Project purpose
Jungs-Jydewhist is a **mobile-first, frontend-only scorekeeper** for René's
house-rule Danish whist variant. It is **not** a card game — it only records
hands and keeps score for live play by four fixed players: René,
Thomas, Carsten, Tom.

## Critical rule
**Scoring correctness is the highest priority.** A wrong score is worse than a
missing feature. The scoring rules are a specific house variant — do **not**
implement generic Whist scoring and do **not** add contracts beyond the 30 in
[src/lib/scoring.js](src/lib/scoring.js).

## Architecture rules
- Keep **scoring logic pure** and separate from the UI — all of it lives in
  [src/lib/scoring.js](src/lib/scoring.js) (no DOM, no React, no storage).
- Keep **persistence** separate from scoring. Storage/cloud code may import scoring;
  never the reverse.
- The scoreboard is **always recomputed** from saved hand deltas
  ([src/state/selectors.js](src/state/selectors.js)); totals are never stored.
- React state has a single source of truth in
  [src/state/AppStateContext.jsx](src/state/AppStateContext.jsx); it is the only
  place that talks to the cloud store.

## Cloud-first mode (current architecture)
- The app is **online-only**. **Cloud Firestore is the only source of truth**: one
  permanent document `history/main` (active `hands` + `archivedSessions`). There is
  no local mode, no offline cache and no silent local fallback.
- Layers: scoring stays pure; Firestore wrappers in
  [src/lib/historyStore.js](src/lib/historyStore.js) / [src/lib/firebase.js](src/lib/firebase.js);
  pure patch/export logic in [src/lib/historyOps.js](src/lib/historyOps.js); pure
  archive/medal helpers in [src/lib/sharedGameUtils.js](src/lib/sharedGameUtils.js).
  `historyStoreFake.js` is test-only (VITE_E2E=1). The Firebase SDK is lazy-loaded.
- **Google sign-in, single owner.** Access is enforced by [firestore.rules](firestore.rules)
  (verified email must equal `config/access.ownerEmail`, set by hand in the console —
  never commit the address). **No Firebase Admin SDK**; no paid plan.
- Every write is a **transaction** and is only reported as saved after Firestore
  acknowledged it. Never show scores from a non-server-confirmed snapshot.
- `storage.js` (old localStorage sessions) is dormant: nothing reads it for display.
- Setup, export/recovery and rollback: [docs/cloud-setup.md](docs/cloud-setup.md).

## Scope guardrails (MVP)
- No custom backend, no password login, no Firebase Admin SDK, no paid plan, no offline mode.
- Players are **fixed** (René, Thomas, Carsten, Tom) — no player editing.
- **Use Danish UI strings.** Code, identifiers and comments are English.
- **Do not expand scope without explicit approval.** New features → add to
  [docs/roadmap.md](docs/roadmap.md) and ask.

## Before changing scoring rules
1. Update / add cases in [src/test/scoring.test.js](src/test/scoring.test.js) **first**.
2. Then change [src/lib/scoring.js](src/lib/scoring.js) until tests pass.

## Run validation before every commit
```
npm test          # Vitest unit tests (scoring + storage) — must be green
npm run build     # production build must succeed
npm run smoke     # Playwright browser smoke (if Chromium is installed)
```
See [docs/pipeline.md](docs/pipeline.md) and
[docs/validation-checklist.md](docs/validation-checklist.md).
