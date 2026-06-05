# Manual browser smoke (fallback)

Use this when Playwright/Chromium isn't available (`npm run smoke` can't run).
It mirrors [../e2e/smoke.spec.js](../e2e/smoke.spec.js).

1. `npm run dev` and open `http://localhost:5173`.
2. The title **"Jungs-Jydewhist"** is visible on the scoreboard.
3. Tap **Nyt spil**. Set Melder = **René**, Melding = **7**, Makker = **Thomas**,
   Stik = **7** (the default for "7"). The preview shows **Vundet** and René **+10**.
4. Tap **Gem spil**. Back on the scoreboard, totals read:
   René **+10**, Thomas **+10**, Carsten **−10**, Tom **−10**, and "Spil i alt: 1".
5. **Reload** the page. The same totals and hand count are still shown
   (localStorage persistence).
6. Tap **Fortryd seneste spil**. All totals return to **0** and "Spil i alt: 0".

If every step matches, the core loop (scoring → save → persist → undo) works.
