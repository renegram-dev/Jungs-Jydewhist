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
      arkivere" warning before clearing (and does NOT touch archived history).

### Manual — resume across app restart (the reported bug)
- [ ] Host: start a shared game, add 1–2 hands, **Arkivér aften og start ny** →
      Samlet historik shows the evening.
- [ ] **Fully close/reload** the app (or relaunch from the home screen) **without**
      `?room=` in the URL.
- [ ] On startup a **“Fortsæt delt spil?”** banner appears → tap **Fortsæt delt spil**.
- [ ] After rejoin, **Samlet historik** still shows the archived evening and the
      cumulative totals are unchanged (loaded from Firestore).
- [ ] **Deltag i delt spil** lists the room under **Seneste delte spil** (rejoin
      with one tap, no code needed).
- [ ] Same device/browser → you are **Delt vært** and can edit; another device →
      **Delt visning** read-only.

### Manual — delete archived evening (host)
- [ ] Host opens **Samlet historik** → each archived evening shows **Slet aften**.
- [ ] Delete an evening → confirm dialog → it disappears for host **and** viewer
      live; cumulative totals update and stay zero-sum; current hands + other
      evenings unchanged.
- [ ] A **viewer** does **not** see **Slet aften** (and the action is rejected in
      the action layer + by Firestore rules).

### Manual — medals & medal-point ranking (shared)
- [ ] With active hands, the scoreboard shows subtle provisional **“Står til 🥇/🥈/🥉/💩”**
      under the names (based on the current evening only).
- [ ] **Arkivér aften og start ny** → that evening shows medals in Samlet historik
      ("Medaljer: René 🥇, Thomas 🥈, …"); permanent counts + medalPoints update.
- [ ] **Medaljestilling** ranks by **medal points** (Guld 3 · Sølv 2 · Bronze 1 ·
      Lort 0), with medal counts and cumulative score shown; confirm a player with
      more medal points but fewer cumulative points still ranks higher.
- [ ] Ties award shared medals (e.g. two equal top scores → two 🥇, no 🥈).
- [ ] Delete an archived evening → medal counts, medalPoints and cumulative score
      recompute live for host and viewer.
- [ ] **Nulstil aktuel session** awards **no** medals and doesn't touch counts.
