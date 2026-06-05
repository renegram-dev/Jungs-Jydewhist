# Roadmap / backlog

Future ideas, intentionally **out of scope** for the MVP. Pull one in only with
explicit approval (see [../CLAUDE.md](../CLAUDE.md)).

## Persistence & sync
- Optional backend / cloud sync so data survives device or browser changes.
- Shared **live scoreboard** across devices during a game.
- Conflict-free merge of imported backups (currently import = new session only).

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
