# Validation checklist

Run before using the app live or shipping a change.

## Automated
- [ ] `npm test` — all unit tests pass (scoring + storage).
- [ ] `npm run build` — production build succeeds with no errors.
- [ ] `npm run smoke` — Playwright smoke passes
      (or do the [manual smoke](browser-smoke-manual.md) if Chromium is absent).

## Manual — scoring sanity (spot-check against the rules)
- [ ] René declares **7** with Thomas, 7 tricks → everyone ±10.
- [ ] Self-partner **8**, 8 tricks → declarer +114, others −38.
- [ ] **Sol**, 0 tricks → declarer +222, others −74; 2 tricks → declarer −234, others +78.
- [ ] **Ren sol**, 0 tricks → declarer +324, others −108.
- [ ] Manual override that doesn't sum to zero → **Gem spil** stays disabled with an error.

## Manual — app behaviour
- [ ] Scoreboard totals sum to zero (no warning banner) after several hands.
- [ ] Delete a hand from history → totals and the visible `#` numbers recompute.
- [ ] **Fortryd seneste spil** removes the last hand.
- [ ] **Nulstil aktuel session** (after confirm) clears hands, keeps the name.
- [ ] Create / rename / switch / delete sessions works; active session is clearly shown.
- [ ] Reload the page → the active session and scores are restored.

## Manual — backup
- [ ] **Kopiér score** puts the scoreboard + history on the clipboard.
- [ ] **Eksportér backup** downloads a JSON file.
- [ ] **Importér backup** of that file adds a **new** session (originals intact).
- [ ] Importing garbage JSON or a wrong player set is rejected with a message.

## Manual — iPhone (the real target)
- [ ] `npm run host`, open `http://<PC-LAN-IP>:5173` in iPhone Safari (same Wi-Fi).
- [ ] Buttons are large/tappable; selects don't auto-zoom the page.
- [ ] Add to Home Screen works and launches standalone.

## Manual — shared mode "Delt spil" (two devices; needs valid Firebase config + published rules)
Prereq: valid web config in `src/firebase.config.js`, Anonymous Auth enabled, and
`firestore.rules` published.
- [ ] Phone A (host): **Start delt spil** → badge shows **Delt vært**, a room code
      and connection **Forbundet** appear.
- [ ] Phone B (viewer): open the shared link (or **Deltag i delt spil** + code) →
      badge shows **Delt visning**; no edit buttons (Nyt spil/Fortryd/Nulstil/Slet).
- [ ] Host adds a hand → it appears on the viewer within a second.
- [ ] Host **Fortryd seneste spil** and **Nulstil aktuel session** → reflected live
      on the viewer.
- [ ] Viewer can still **Kopiér score**, open **Scoringsregler**, see history.
- [ ] Reopen the link later → the shared game is still there (Firestore persistence).
- [ ] A viewer attempting to write is blocked (read-only UI; rules also deny it).

### Manual — long-term history / cumulative (shared)
- [ ] Host plays a few hands, then **Arkivér aften og start ny** → active board
      clears; same room code/link remain.
- [ ] **Samlet historik** (host and viewer): shows the archived evening with its
      totals + hand count, the (now empty) current evening separately, and a
      **cumulative** total that still equals the archived evening's totals.
- [ ] Play another evening and archive it → cumulative = sum of both evenings;
      it stays **zero-sum** (no warning).
- [ ] Expanding an archived evening shows its hand history.
- [ ] Viewers see **Samlet historik** but have **no** Arkivér / Nulstil buttons.
- [ ] **Nulstil aktuel session** in shared mode shows the strong "rydder uden at
      arkivere" warning before clearing.
