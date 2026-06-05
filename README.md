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

## Build

```powershell
npm run build       # outputs static files to dist/
npm run preview     # serve the built dist/ locally (also binds 0.0.0.0)
```

## Deploy as a static site (optional)

The build is fully static, so any static host works.

- **Vercel / Netlify:** build with `npm run build` and deploy the `dist/` folder
  (or connect the repo and use build command `npm run build`, output dir `dist`).
- **GitHub Pages:** the site lives under a sub-path, so set the base path:
  ```powershell
  $env:DEPLOY_BASE = '/Jungs-Jydewhist/'
  npm run build
  # publish the dist/ folder to the gh-pages branch / Pages source
  ```

A fixed deploy URL keeps the origin stable → more reliable localStorage across
sessions.

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
[src/test/scoring.test.js](src/test/scoring.test.js).

- **30 contracts** in a fixed bidding order (ids 0–29):
  `7, 7 halve, 7 gode, 7 VIP, 8, 8 halve, 8 gode, 8 VIP, 9, Sol, 9 halve,
  9 gode, 9 VIP, 10, Ren sol, 10 halve, 10 gode, 10 VIP, 11, 11 halve, …, 13 VIP`.
  (Sol sits between 9 and 9 halve; Ren sol between 10 and 10 halve. No Sans, no
  Bordlægger.)
- **Base points:** `basePoints = 10 + 7 × rank` (rank = the id). So `7` = 10,
  `7 halve` = 17, `8` = 38, `9` = 66, `Sol` = 73, `10` = 101, `Ren sol` = 108.
- **Ordinary number contracts** (incl. *halve* / *gode* / *VIP*, which only
  change which suit is trump): the declarer side must take at least the contract
  number of tricks.
  - Success: `handPoints = basePoints + overtricks × 1`.
  - Failure: `handPoints = basePoints + undertricks × 5`.
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
