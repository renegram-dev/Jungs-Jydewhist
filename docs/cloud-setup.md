# Cloud setup, export/recovery and rollback

The app is **cloud-first and online-only**. One permanent history lives in Firestore
document `history/main`. Only the owner's Google account can read or write it.
Spark plan, no Admin SDK.

## One-time Firebase Console steps (René)

Project: `jungs-jydewhist`.

1. **Authentication → Sign-in method → Google → Enable.** Pick a support email, Save.
2. **Authentication → Settings → Authorized domains → Add domain:** `renegram-dev.github.io`.
3. **Firestore Database → Data → Start collection** `config` → Document ID `access` →
   field `ownerEmail` (type *string*) = your Google address. Save.
   (This keeps the address out of the public repo. Clients can never read this doc.)
4. **Firestore Database → Rules** → replace everything with the contents of
   [../firestore.rules](../firestore.rules) → **Publish**. This is additive: the legacy
   `sharedGames` rules are unchanged, so the previous app build keeps working.

## Cutover

1. Build the seed (offline, read-only on the backup):
   `node scripts/history-tools.mjs build "<backup folder>" "<somewhere>/seed.json"`
   It must print `Seed OK`, 2 evenings and `total hands: 20`. Any mismatch aborts.
2. Open the deployed app, sign in with Google. It shows *"Historikken findes ikke i skyen"*
   (this is deliberate, never an empty history). Choose **Importér historik** and select `seed.json`.
   Import is create-only: it refuses if `history/main` already exists.
3. In the app press **Eksportér historik**, then verify:
   `node scripts/history-tools.mjs verify "<downloaded export>.json" "<seed.json>"` → `VERIFY OK`.

## Export and recovery

- **Export:** *Eksportér historik* on the scoreboard downloads the whole history as JSON
  (active evening + all archived evenings). Spark has no automatic backups, so
  **export after each evening** and keep the file.
- **Recovery:** if `history/main` is ever missing, the app shows the "Historikken findes ikke" screen.
  Choose **Importér historik** and select the latest export. Re-run the `verify` command.
- The verified legacy backup folder (`05_Data/firestore-backups/...`) and the legacy
  `sharedGames` rooms are never modified by the app.
- Old local-mode data (if any) still sits in each browser; the app offers a raw JSON download for it.

## Rollback

- The legacy rooms and rules are untouched, so redeploying the previous commit restores the old app.
- **Games entered after cutover exist only in `history/main`** (the old build cannot see them).
  Before any rollback: press *Eksportér historik* and keep the file. Re-import it after the
  problem is fixed. Never roll back without that export.
- Do not make `sharedGames` read-only until this procedure has been used or rehearsed.

## Failure behaviour (by design)

| Situation | What the app shows |
| --- | --- |
| Not signed in | Google login only |
| No connection / not server-confirmed | Full-screen "Ingen forbindelse", no scores, no editing |
| Wrong Google account / rules denial | "Ingen adgang" error screen |
| `history/main` missing | "IKKE en tom historik" screen with import |
| A write fails | Red "Ikke gemt" message; the hand is not recorded |

## iPhone note

Sign-in uses the Google pop-up from a button tap. In Safari this works. If the installed
home-screen app cannot sign in, use the site in Safari instead.
