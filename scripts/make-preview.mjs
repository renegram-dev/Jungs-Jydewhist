// Generate public/share-preview.png (1200x630 Open Graph image) by rendering a
// small HTML design with the already-installed Playwright Chromium — no image
// libraries needed.
//   node scripts/make-preview.mjs
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  html, body { margin: 0; padding: 0; }
  .card {
    width: 1200px; height: 630px; box-sizing: border-box; padding: 90px;
    background: linear-gradient(135deg, #0b6b3a 0%, #084f2b 100%);
    color: #f2f5f3; font-family: Arial, Helvetica, sans-serif;
    display: flex; flex-direction: column; justify-content: center; position: relative;
  }
  .title { font-size: 104px; font-weight: 800; letter-spacing: -1px; }
  .subtitle { font-size: 44px; margin-top: 18px; color: #cfe8d8; }
  .cards { position: absolute; right: 90px; bottom: 84px; display: flex; gap: 20px; }
  .chip {
    width: 116px; height: 158px; background: #f5f7f3; border-radius: 16px;
    display: flex; align-items: center; justify-content: center;
    font-size: 46px; font-weight: 800; color: #0b6b3a;
    box-shadow: 0 12px 32px rgba(0,0,0,.35);
  }
</style></head>
<body>
  <div class="card">
    <div class="title">Jungs-Jydewhist</div>
    <div class="subtitle">Delt live-score til kortspillet</div>
    <div class="cards">
      <div class="chip">R</div><div class="chip">T</div><div class="chip">C</div><div class="chip">T</div>
    </div>
  </div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
await page.screenshot({
  path: fileURLToPath(new URL('../public/share-preview.png', import.meta.url)),
  clip: { x: 0, y: 0, width: 1200, height: 630 },
});
await browser.close();
console.log('wrote public/share-preview.png (1200x630)');
