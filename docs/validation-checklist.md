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
