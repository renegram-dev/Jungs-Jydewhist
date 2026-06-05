# Jungs-Jydewhist

A simple, robust, **mobile-first scorekeeper** for René's offline Danish
house-rule whist variant **Jungs-Jydewhist**, played by four fixed players:
**René, Thomas, Carsten, Tom**.

It is **not** a card game — it only keeps score for live, offline play. Built
with React + Vite, **frontend-only**: no backend, no login, no database. All
state is saved in your browser's `localStorage`.

> Project working rules: [CLAUDE.md](CLAUDE.md) ·
> Build summary: [docs/current-build-summary.md](docs/current-build-summary.md) ·
> Roadmap: [docs/roadmap.md](docs/roadmap.md) ·
> Validation: [docs/validation-checklist.md](docs/validation-checklist.md) ·
> Pipeline: [docs/pipeline.md](docs/pipeline.md)

## Install

```powershell
npm install
```

If `npm install` fails with `UNABLE_TO_VERIFY_LEAF_SIGNATURE` (a corporate
proxy / SSL-inspection network), point Node at the Windows trust store instead of
disabling TLS verification:

```powershell
# Export the Windows trusted roots once:
$out = Join-Path $env:USERPROFILE 'jjw-ca-bundle.pem'
$blocks = foreach ($s in 'Cert:\LocalMachine\Root','Cert:\CurrentUser\Root','Cert:\LocalMachine\CA') {
  Get-ChildItem $s | ForEach-Object {
    "-----BEGIN CERTIFICATE-----`r`n" +
    [Convert]::ToBase64String($_.RawData,'InsertLineBreaks') +
    "`r`n-----END CERTIFICATE-----"
  }
}
Set-Content $out ($blocks -join "`r`n") -Encoding ascii

# Then install (and run any npx that downloads, e.g. Playwright) with:
$env:NODE_EXTRA_CA_CERTS = $out
npm install
```

## Run locally

```powershell
npm run dev
```

Open the printed URL (default <http://localhost:5173>).

## Open from an iPhone on the same Wi-Fi

```powershell
npm run host        # binds 0.0.0.0 so other devices can reach it
```

1. Find your PC's LAN IP: run `ipconfig` and read the IPv4 address (e.g.
   `192.168.1.42`).
2. On the iPhone (same Wi-Fi), open `http://<PC-LAN-IP>:5173`, e.g.
   `http://192.168.1.42:5173`.
3. First time, Windows may ask to allow Node.js through the firewall — allow it
   on **Private** networks.
4. Optional: in Safari, **Share → Add to Home Screen** to launch it like an app
   (a PWA manifest + icons are included).

The iPhone's Safari `localStorage` then holds that device's saved games — treat
the phone as the primary saved state if you play from it.

## How persistence works (read this)

- All data is stored in the browser under the key `jungs-jydewhist.v1`. The
  **browser/device is the source of truth**.
- On load, the most-recently-active session is restored.
- The scoreboard is **recomputed from the saved hand history**, never kept as a
  separate fragile total — so it always sums to zero (you get a warning if it
  somehow doesn't).

⚠️ **Limitations of frontend-only storage:**
- Data is local to **one browser and one URL origin**. It is **not** synced
  between devices.
- It may be **unavailable from a different local IP / URL** (e.g. localhost vs
  your LAN IP are different origins).
- It can **disappear if you clear browser data**.
- ➡️ Use **Eksportér backup** / **Importér backup** to move data between
  devices/origins. Deploying to a fixed static URL (below) keeps the origin
  stable, which makes localStorage reliable across future sessions.

## How sessions work

- The app supports **multiple saved game sessions**, not just one current game.
- A session has: id, created/updated timestamps, name, the players, and the full
  hand history. Default name is like `Jungs-Jydewhist 2026-06-05`.
- From the scoreboard: **Ny session** (create), **Vælg session** (open the
  session manager to resume / rename / delete). The active session name is shown
  at the top.
- Deleting a session asks for confirmation. Players are fixed in this version.

## Backup / portability

- **Kopiér score** — copies the scoreboard + compact hand history as text to the
  clipboard.
- **Eksportér backup** — downloads the full app state as a JSON file.
- **Importér backup** — paste JSON or pick a file. It is **validated** and
  imported as a **new session** (your existing sessions are never overwritten).
  The player set must be exactly René, Thomas, Carsten, Tom or the import is
  rejected.

## iPhone home screen & link previews

**Add to Home Screen (looks like an app):**
1. Open **https://renegram-dev.github.io/Jungs-Jydewhist/** in **Safari** (this
   must be Safari, not Chrome, for the icon to apply).
2. Tap the **Share** button (the square with an up-arrow).
3. Tap **Add to Home Screen** → **Add**. It launches standalone with the
   Jungs-Jydewhist icon (a green tile) and no Safari chrome.

> If the icon doesn't update after a change, **remove the old home-screen
> shortcut and add it again** (iOS caches the icon per shortcut).

**Link previews:** sharing the link (or a `?room=` shared link) shows a preview
card with the title, description and image where supported (iMessage, WhatsApp,
Slack, etc.). Messaging apps **cache previews**, so a freshly changed image can
take a while (or a re-send) to refresh.

## Delt spil (shared game mode)

By default the app runs in **local mode** (localStorage, one device). It also has
an optional **shared mode ("Delt spil")** backed by **Cloud Firestore** so several
phones can watch the same game live.

- **Local mode** — localStorage is the source of truth (unchanged). Badge: **Lokal**.
- **Shared mode** — **Firestore is the source of truth** for that game. The host
  edits; everyone else is read-only; all phones update live via Firestore
  `onSnapshot`. Badges: **Delt vært** (host) / **Delt visning** (viewer).

Auth is **Firebase Anonymous Auth** — no usernames or passwords. The two modes are
kept separate; local sessions and shared games are not auto-merged.

### Create / join a shared game
- **Host:** on the scoreboard tap **Start delt spil**. The app signs in
  anonymously, creates `sharedGames/{roomCode}` (seeded from your current local
  session), and shows the **room code** and **Kopiér delt link**.
- **Join:** open the share link
  `https://renegram-dev.github.io/Jungs-Jydewhist/?room=<roomCode>` (auto-joins),
  or tap **Deltag i delt spil** and type the code. You join as a **read-only
  viewer** (unless you are the host on that device).
- **Viewers** can see the scoreboard, history, Scoringsregler, and Kopiér score,
  but cannot add/undo/clear/delete hands or import into the shared game.

### Long-term history & cumulative score
A shared room is **persistent and reused across game nights** — the room link/code
is effectively the access key. The room keeps a long-term log so the group sees
**cumulative scoring over time**:
- **Host:** when an evening ends, tap **Arkivér aften og start ny**. The current
  hands are saved (with their final totals) into the room's archive and the active
  board is cleared for the next evening — same room code, link and players.
- **Everyone (host + viewers):** tap **Samlet historik** to see the **cumulative
  lifetime total** (all archived evenings + the current one), the current evening
  shown separately, and each archived evening (name, date, hand count, totals, with
  expandable hand history).
- **Host can delete an archived evening** from **Samlet historik** (the **Slet
  aften** button, host-only, with a confirm) — handy for removing test evenings.
  Cumulative totals recompute; current hands and other evenings are untouched.
- **Nulstil aktuel session** still exists but is the *destructive* option — it
  clears the active evening **without** archiving it (with a clear warning). Prefer
  **Arkivér aften og start ny** to preserve history.

Cumulative totals are always zero-sum (a warning shows otherwise). Older rooms
created before this feature simply have an empty archive — nothing breaks.

### Resuming a shared room after closing the app
Shared data lives in **Firestore**, not localStorage — closing the app never
deletes it. To make a relaunch reconnect automatically, the app remembers your
**last room** (room code + name only, in localStorage):
- Opening the **share link** (`?room=…`) always rejoins that room.
- Otherwise, on startup the app shows **“Fortsæt delt spil?”** with **Fortsæt
  delt spil** (rejoin — archive/cumulative history reloads from Firestore) and
  **Bliv lokal** (stay in local mode).
- **Deltag i delt spil** also lists **Seneste delte spil** so you can rejoin a
  previous room with one tap — no need to remember the code.
- Anonymous auth persists per browser/PWA, so rejoining the **same device** keeps
  you as **Delt vært** (editable). Rejoining from a **different device** is
  read-only **Delt visning** (the badge makes this obvious).

### Firebase setup (one-time, by the project owner)
The web config lives in [src/firebase.config.js](src/firebase.config.js) — it is
**not a secret** (security comes from Firestore rules). Steps:
1. Firebase Console → create a project → add a **Web app** → copy the config.
2. **Build → Firestore Database → Create database** (production mode).
3. **Build → Authentication → Sign-in method → enable Anonymous**.
4. Paste the web config into `HARDCODED` in
   [src/firebase.config.js](src/firebase.config.js) (or set `VITE_FIREBASE_*` env
   vars). Blank values keep the app in local-only mode.
5. **Publish the Firestore security rules** (next section).

### Firestore security rules
The intended rules are in [firestore.rules](firestore.rules). Publish them with
**either**:
- **Console (no CLI):** Firebase Console → **Firestore Database → Rules** → paste
  the contents of `firestore.rules` → **Publish**.
- **CLI:** `firebase login`, then from the repo root
  `firebase deploy --only firestore:rules` (needs a `firebase.json` with
  `{"firestore": {"rules": "firestore.rules"}}` and the project selected).

Security model: auth required for everything; a signed-in user may **read** a
single game only if they know its room code (`get`; **`list` is denied**); only
the **host** (the uid that created it) may create/update/delete it, and the host
field is immutable.

### Limitations
- No real login — the **room code works like a shared secret**; anyone with it (and
  signed in anonymously) can view that game.
- **Viewers are read-only**; only the host edits, so there is no multi-editor
  conflict handling.
- Anonymous auth means anyone could create their own games — fine for casual use;
  Firebase **free (Spark) tier** is plenty for normal play, but usage is subject to
  Firebase limits/pricing. (App Check / abuse mitigation is a future item.)
- Shared data lives in Firestore; local games stay in localStorage. They are
  **not** merged automatically.

## Build

```powershell
npm run build       # outputs static files to dist/
npm run preview     # serve the built dist/ locally (also binds 0.0.0.0)
```

## Deploy (GitHub Pages — stable HTTPS URL)

This repo deploys automatically to **GitHub Pages** via GitHub Actions
([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) on every push to
`main`. The site is served under a sub-path, so the workflow builds with
`DEPLOY_BASE=/Jungs-Jydewhist/` (matching the repo name).

- **Live URL:** `https://renegram-dev.github.io/Jungs-Jydewhist/`
- To redeploy: just push to `main` (or run the workflow manually from the
  Actions tab). No PC needs to stay on.

Other static hosts also work (the build in `dist/` is fully static): on
Vercel/Netlify use build command `npm run build`, output dir `dist` (root base,
no `DEPLOY_BASE` needed).

### Moving from the local/LAN version to the stable URL

`localStorage` is **per origin**, so the LAN URL (`http://<PC-IP>:5173`) and the
Pages URL are **separate stores** — saved games do not transfer automatically.
To carry a game over:

1. On the **old** URL (PC or the LAN URL on the phone), tap **Eksportér backup**
   and keep the JSON file (AirDrop/email it to the phone, or save to Files).
2. Open the **stable Pages URL** on the iPhone and **Add to Home Screen**.
3. Tap **Importér backup** there and load the JSON — it lands as a new session.
4. Use the **stable URL from now on** so your data stays on one origin.

If you start fresh on the Pages URL, you can skip the export/import entirely.

## Testing / validation

```powershell
npm test            # Vitest unit tests (scoring + storage)
npm run smoke       # Playwright Chromium browser smoke (needs Chromium once:
                    #   npx playwright install chromium)
```

See [docs/validation-checklist.md](docs/validation-checklist.md) for the full
manual + automated checklist, and
[docs/browser-smoke-manual.md](docs/browser-smoke-manual.md) for a no-Playwright
fallback.

## Scoring assumptions

This is René's **house-rule variant** — not generic Whist. The rules are encoded
in [src/lib/scoring.js](src/lib/scoring.js) and pinned by
[src/test/scoring.test.js](src/test/scoring.test.js). The app also has a built-in
read-only **Scoringsregler** button on the scoreboard with this full overview.

- **30 contracts** in a fixed bidding order (ids 0–29):
  `7, 7 halve, 7 gode, 7 VIP, 8, 8 halve, 8 gode, 8 VIP, 9, Sol, 9 halve,
  9 gode, 9 VIP, 10, Ren sol, 10 halve, 10 gode, 10 VIP, 11, 11 halve, …, 13 VIP`.
  (Sol sits between 9 and 9 halve; Ren sol between 10 and 10 halve. No Sans, no
  Bordlægger.)
- **Base points (non-VIP):** `basePoints = 10 + 7 × rank` (rank = the id). So `7`
  = 10, `7 halve` = 17, `8` = 38, `9` = 66, `Sol` = 73, `10` = 101, `Ren sol` =
  108.
- **VIP base (special):** a VIP contract's base is **not** `10 + 7×rank`. It
  depends on which exchanged ("vipped") card the declarer chose as trump:
  `vipBase = (plain-number base) × position`, where position is 1/2/3 for the
  1st/2nd/3rd VIP card (første/anden/tredje). E.g. `7 VIP i anden` = 10 × 2 = 20;
  `8 VIP i tredje` = 38 × 3 = 114. The hand form asks **"Hvilket VIP-kort blev
  trumf?"** and won't save a VIP hand until a card is picked. (Legacy v1 VIP
  hands without a stored card keep their old score and are flagged "gammel
  scoring".)
- **Ordinary number contracts** (incl. *halve* / *gode* / *VIP* — *halve*/*gode*
  only change which suit is trump): the declarer side must take at least the
  contract number of tricks.
  - Success: `handPoints = base + overtricks × 1`.
  - Failure: `handPoints = base + undertricks × 5`.
  - (So bidding higher and making it beats bidding low for overtricks;
    undertricks hurt more than overtricks help.)
- **Sol** (rank 9, base 73): declarer alone, may take **at most 1** trick.
  1 trick → 73; 0 tricks → 74; failure (≥2) → `73 + (tricks−1) × 5`.
- **Ren sol** (rank 14, base 108): declarer alone, must take **0** tricks.
  0 tricks → 108; failure (≥1) → `108 + tricks × 5`.
- **Distribution (always zero-sum):**
  - With a partner: declarer & partner each ±handPoints; the two opponents each
    ∓handPoints.
  - Selvmakker (self) and Sol/Ren sol (solo): declarer alone ±3×handPoints; each
    of the other three ∓handPoints.
- **Manual override:** you can override the four deltas for a hand, but they must
  sum to zero or the hand can't be saved. The override is recorded on the hand.

## Project layout

```
src/lib/scoring.js          Pure scoring engine (no UI/storage)
src/lib/storage.js          localStorage schema, session CRUD, import/export
src/lib/browser.js          clipboard / download / file-read helpers
src/state/AppStateContext.jsx  Single source of truth; only localStorage writer
src/state/selectors.js      Recomputed totals & display numbers
src/state/report.js         "Kopiér score" text builder
src/components/             React UI (Scoreboard, NewHandForm, HandHistory, …)
src/test/                   Vitest unit tests
e2e/smoke.spec.js           Playwright smoke test
docs/                       Project docs (see links at top)
```
