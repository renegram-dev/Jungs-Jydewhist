# CLAUDE.md — working rules for Jungs-Jydewhist

Concise instructions for anyone (human or AI) working in this repo.

## Project purpose
Jungs-Jydewhist is a **mobile-first, frontend-only scorekeeper** for René's
house-rule Danish whist variant. It is **not** a card game — it only records
hands and keeps score for live, offline play by four fixed players: René,
Thomas, Carsten, Tom.

## Critical rule
**Scoring correctness is the highest priority.** A wrong score is worse than a
missing feature. The scoring rules are a specific house variant — do **not**
implement generic Whist scoring and do **not** add contracts beyond the 30 in
[src/lib/scoring.js](src/lib/scoring.js).

## Architecture rules
- Keep **scoring logic pure** and separate from the UI — all of it lives in
  [src/lib/scoring.js](src/lib/scoring.js) (no DOM, no React, no storage).
- Keep **localStorage / session persistence** separate from scoring — it lives
  in [src/lib/storage.js](src/lib/storage.js). Storage may import scoring; never
  the reverse.
- The scoreboard is **always recomputed** from saved hand deltas
  ([src/state/selectors.js](src/state/selectors.js)); totals are never stored.
- React state has a single source of truth in
  [src/state/AppStateContext.jsx](src/state/AppStateContext.jsx); it is the only
  place that writes to localStorage.

## Shared mode ("Delt spil")
- Optional. **Local mode stays the default and unchanged** (localStorage).
- In shared mode, **Cloud Firestore is the source of truth** (`sharedGames/{roomCode}`).
- Keep the layers separate: scoring stays pure; Firestore wrappers live in
  [src/lib/sharedGame.js](src/lib/sharedGame.js) / [src/lib/firebase.js](src/lib/firebase.js);
  pure helpers (no Firebase import) in [src/lib/sharedGameUtils.js](src/lib/sharedGameUtils.js).
- The Firebase SDK is **lazy-loaded** (dynamic import) — don't statically import it
  into the main bundle.
- **Anonymous Auth only** — no usernames/passwords. **No Firebase Admin SDK.** Web
  config is **not a secret**; security is enforced by [firestore.rules](firestore.rules)
  (auth required, room-code read, **host-only** write, no `list`). Don't loosen these.
- Host edits; **viewers are strictly read-only** (gate UI on `canEdit`). All clients
  update via `onSnapshot`.

## Scope guardrails (MVP)
- No custom backend, no password login, no Firebase Admin SDK, no paid plan.
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
