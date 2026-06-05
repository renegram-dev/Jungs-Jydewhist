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
supports JSON backup export/import. It is **not** a card game. It also has an
optional **shared mode ("Delt spil")** backed by Cloud Firestore.

## Modes: local vs shared
- **Local mode (default):** localStorage is the source of truth (one device).
- **Shared mode ("Delt spil"):** Cloud Firestore is the source of truth for that
  game (`sharedGames/{roomCode}`). The host edits; viewers are read-only; all
  phones update live via `onSnapshot`. Auth is Firebase **Anonymous Auth** (no
  login). The Firebase SDK is lazy-loaded (separate ~108 KB-gz chunk), so
  local-only users don't download it. Modules:
  [../src/lib/firebase.js](../src/lib/firebase.js),
  [../src/lib/sharedGame.js](../src/lib/sharedGame.js),
  [../src/lib/sharedGameUtils.js](../src/lib/sharedGameUtils.js); config in
  [../src/firebase.config.js](../src/firebase.config.js); rules in
  [../firestore.rules](../firestore.rules). Security: room-code read, host-only
  write, no listing. Local and shared data are kept separate (no auto-merge).
- **Long-term history (shared):** a room is reused across game nights. The host's
  **Arkivér aften og start ny** moves the current hands (with frozen totals) into
  `archivedSessions` and clears the active board; **Samlet historik** shows the
  **cumulative** lifetime score (archived + current) to host and viewers. Missing
  `archivedSessions` is treated as `[]` (old rooms keep working); cumulative is
  zero-sum. No scoring/auth/rules change (same `sharedGames/{roomCode}` doc).
- **Resume across restarts:** the app stores only pointers
  ([../src/lib/sharedMeta.js](../src/lib/sharedMeta.js)): `lastSharedRoomCode` +
  a recent-rooms list in localStorage (never the shared hands). On startup,
  `?room=` rejoins; otherwise a **“Fortsæt delt spil?”** banner offers rejoin vs
  stay-local, and **Deltag i delt spil** lists **Seneste delte spil**. This fixes
  the "history disappears after restart" report — the data was always in Firestore;
  the PWA just relaunched without `?room=`.
- **Host can delete an archived evening** in Samlet historik (host-only `Slet
  aften` → `removeArchivedSession` → Firestore update; viewers can't). Same doc +
  host-only rule, so **no rules republish**.
- **Medals & medal-point ranking:** each archived evening awards permanent medals
  by its final score (🥇/🥈/🥉/💩, competition-ranking ties). Samlet historik →
  **Medaljestilling** ranks by **medal points** (Guld 3 · Sølv 2 · Bronze 1 · Lort 0),
  **not** cumulative points (shown as secondary). Pure helpers in
  [../src/lib/sharedGameUtils.js](../src/lib/sharedGameUtils.js)
  (`rankPlayersByScore`, `computeMedalsForTotals`, `aggregateMedalCounts`,
  `computeMedalPoints`, `buildMedalStandings`); medals stored on each archived
  entry, derived on read for legacy evenings. The live scoreboard shows
  *provisional* "Står til" medals for the current evening (don't count until
  archived). Same doc → **no rules republish**.

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
- ✅ `npm test` — 84 unit tests pass (scoring incl. VIP-by-position; storage
  round-trip + legacy; shared-game utils incl. archive payload, cumulative,
  remove archived, migration; **medals**: per-evening ranking + all tie cases,
  aggregate counts, medal points, ranks-by-medal-points-not-cumulative,
  provisional; shared-room metadata).
- ✅ `npm run build` — production build succeeds (Firebase code-split into a lazy
  chunk; main bundle ~unchanged).
- ✅ `npm run smoke` — Playwright Chromium, 5 tests: core (now also asserts the
  provisional "Står til 🥇" medal), VIP, Scoringsregler, shared controls in local
  mode, and the resume banner (seeded localStorage, no live connect).
- ✅ Verified by REST round-trip that **archiving persists `archivedSessions` to
  Firestore and survives a fresh read** — the restart issue was resume, not data loss.
- ✅ **Shared mode is ACTIVE:** valid Firebase web API key (anonymous sign-in
  verified), Anonymous Auth on, **Firestore rules published** (authed read returns
  404, not 403), deployed to Pages. The archive/cumulative feature uses the same
  doc + host-only rule — **no rules republish needed**.
- ⏳ Manual iPhone-over-Wi-Fi pass and **live two-phone shared test** (incl.
  archive + Samlet historik) — see [validation-checklist.md](validation-checklist.md).
