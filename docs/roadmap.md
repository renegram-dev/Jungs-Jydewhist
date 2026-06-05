# Roadmap / backlog

Future ideas, intentionally **out of scope** for the MVP. Pull one in only with
explicit approval (see [../CLAUDE.md](../CLAUDE.md)).

## Persistence & sync
- ✅ **Shared live scoreboard** across devices — implemented as "Delt spil"
  (Cloud Firestore + anonymous auth, host edits, viewers read-only, live
  `onSnapshot`). See [current-build-summary.md](current-build-summary.md).
- Conflict-free merge of imported backups (currently import = new session only).
- Optional sync of *local* sessions to the cloud (currently local stays local).

## Shared mode (Firebase) follow-ups
- Custom per-evening names, and rename/delete of archived evenings in
  **Samlet historik** (today each archived evening takes the room name + date).
- Export the whole shared room (incl. `archivedSessions`) as a JSON backup.
- **App Check / abuse mitigation** so anonymous users can't spam game creation.
- Auto-clean or TTL for old shared games (Firestore usage hygiene).
- "Kopiér lokal session til delt spil" as a distinct action (today "Start delt
  spil" seeds from the current local session).
- Host hand-off / multiple hosts; viewer presence ("hvem ser med").
- Commit a `firebase.json` + add a `deploy:rules` npm script for one-command
  rules deploys.

## Players
- **Player editing** (rename, add/remove, more than four) — deliberately omitted
  in the MVP where players are fixed (René, Thomas, Carsten, Tom).
- Per-session player rosters.

## Install & deployment
- Better **PWA / install flow** (service worker for true offline, install prompt,
  nicer icons/splash).
- **Cloud deploy** to a fixed static URL (Vercel / Netlify / GitHub Pages) so the
  origin — and therefore localStorage — stays stable across sessions.

## Reporting
- **Print-friendly / share-friendly** score summary view (beyond the current
  "Kopiér score" text).
- Per-player statistics across sessions.

## Quality
- Component-level tests for the forms and session manager.
- Expanded smoke coverage (sessions, backup import/export, manual override).

## CI / tooling
- **Bump GitHub Actions versions to silence the Node.js 20 deprecation warning**
  in [../.github/workflows/deploy.yml](../.github/workflows/deploy.yml). It is
  **non-blocking** (the `@v4` actions still run fine) — a low-priority cleanup.
