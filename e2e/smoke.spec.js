import { test, expect } from '@playwright/test';

// Extremely small end-to-end smoke test: load, add one known hand, verify the
// scoreboard, verify persistence across reload, verify undo zeroes the totals.
test('scorekeeper smoke: add hand, persist, undo', async ({ page }) => {
  await page.goto('/');

  // 1) App loads and the title is visible.
  await expect(page.getByTestId('app-title')).toHaveText('Jungs-Jydewhist');

  // 2) Create one hand: René declares 7 with Thomas as partner, 7 tricks.
  await page.getByTestId('new-hand-btn').click();
  await page.getByTestId('declarer-select').selectOption('René');
  await page.getByTestId('contract-select').selectOption({ label: '7' });
  await page.getByTestId('partner-select').selectOption('Thomas');
  await expect(page.getByTestId('tricks-value')).toHaveText('7'); // default for "7"

  // Preview should already show the winning split.
  await expect(page.getByTestId('preview-result')).toHaveText('Vundet');
  await expect(page.getByTestId('preview-delta-René')).toHaveText('+10');

  await page.getByTestId('save-hand').click();

  // 3) Scoreboard shows René +10, Thomas +10, Carsten -10, Tom -10.
  await expect(page.getByTestId('total-René')).toHaveText('+10');
  await expect(page.getByTestId('total-Thomas')).toHaveText('+10');
  await expect(page.getByTestId('total-Carsten')).toHaveText('-10');
  await expect(page.getByTestId('total-Tom')).toHaveText('-10');
  await expect(page.getByTestId('hand-count')).toHaveText('Spil i alt: 1');

  // Provisional ("Står til") medal shows on the live scoreboard — René leads → 🥇.
  await expect(page.getByTestId('prov-René')).toContainText('🥇');

  // 4) Reload — the saved score still shows (cloud persistence; test store survives reload).
  await page.reload();
  await expect(page.getByTestId('total-René')).toHaveText('+10');
  await expect(page.getByTestId('total-Tom')).toHaveText('-10');
  await expect(page.getByTestId('hand-count')).toHaveText('Spil i alt: 1');

  // 5) "Fortryd seneste spil" returns all totals to zero.
  await page.getByTestId('undo-btn').click();
  for (const name of ['René', 'Thomas', 'Carsten', 'Tom']) {
    await expect(page.getByTestId(`total-${name}`)).toHaveText('0');
  }
  await expect(page.getByTestId('hand-count')).toHaveText('Spil i alt: 0');
});

test('VIP requires a trump card before saving, then scores by position', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('new-hand-btn').click();
  await page.getByTestId('contract-select').selectOption({ label: '7 VIP' });

  // The VIP card field is shown and saving is blocked until a card is chosen.
  await expect(page.getByTestId('vip-2')).toBeVisible();
  await expect(page.getByTestId('save-hand')).toBeDisabled();
  await expect(page.getByTestId('vip-required-note')).toBeVisible();

  // Choose "2. kort / anden" -> base 20, 7 tricks (default) -> +20 each on declarer side.
  await page.getByTestId('vip-2').click();
  await expect(page.getByTestId('preview-delta-René')).toHaveText('+20');
  await expect(page.getByTestId('save-hand')).toBeEnabled();
  await page.getByTestId('save-hand').click();

  await expect(page.getByTestId('total-René')).toHaveText('+20');
  await expect(page.getByTestId('total-Carsten')).toHaveText('-20');
  await expect(page.getByTestId('hand-history')).toContainText('7 VIP i anden');
});

test('Scoringsregler overview opens with the key rules text', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('rules-btn').click();
  const rules = page.getByTestId('rules-content');
  await expect(rules).toBeVisible();
  await expect(rules).toContainText('basePoints = 10 + 7');
  await expect(rules).toContainText('VIP base');
  await expect(rules).toContainText('undertricks × 5');
  await expect(rules).toContainText('Sol');
  await expect(rules).toContainText('Ren sol');
  // Version/build label is shown at the bottom of the rules.
  await expect(page.getByTestId('app-version')).toContainText('Version:');
});

// ---- Cloud-first gate (runs against the test-only in-memory store, VITE_E2E=1) ----

test('signed-out users only see the Google login, never a scoreboard', async ({ page }) => {
  await page.goto('/?e2e=signedout');
  await expect(page.getByTestId('google-login-btn')).toBeVisible();
  await expect(page.getByTestId('scoreboard')).toHaveCount(0);
  await expect(page.getByTestId('total-René')).toHaveCount(0);
  await page.getByTestId('google-login-btn').click();
  await expect(page.getByTestId('scoreboard')).toBeVisible();
  await expect(page.getByTestId('mode-badge')).toHaveText('Sky');
  // Logging out removes the data from the screen again.
  await page.getByTestId('logout-btn').click();
  await expect(page.getByTestId('google-login-btn')).toBeVisible();
  await expect(page.getByTestId('scoreboard')).toHaveCount(0);
});

test('no connection / permission denied are explicit and show no scores', async ({ page }) => {
  await page.goto('/?e2e=offline');
  await expect(page.getByTestId('offline-overlay')).toBeVisible();
  await expect(page.getByTestId('total-René')).toHaveCount(0);

  await page.goto('/?e2e=denied');
  await expect(page.getByTestId('error-message')).toContainText('Ingen adgang');
  await expect(page.getByTestId('total-René')).toHaveCount(0);
});

test('missing cloud history is flagged, not shown as empty, and can be restored from an export', async ({ page }) => {
  await page.goto('/?e2e=missing');
  await expect(page.getByTestId('missing-message')).toContainText('IKKE en tom historik');
  await expect(page.getByTestId('scoreboard')).toHaveCount(0);

  const doc = {
    format: 'jungs-jydewhist-history',
    version: 1,
    doc: {
      roomCode: 'main',
      sessionName: 'Aften',
      players: ['René', 'Thomas', 'Carsten', 'Tom'],
      hands: [],
      archivedSessions: [
        {
          id: 'ev1', name: '5. juni', startedAt: '2026-06-05T18:00:00.000Z', archivedAt: '2026-06-05T23:00:00.000Z',
          hands: [{ id: 'h1', timestamp: '2026-06-05T18:00:00.000Z', delta: { René: 10, Thomas: 10, Carsten: -10, Tom: -10 } }],
          totals: { René: 10, Thomas: 10, Carsten: -10, Tom: -10 }, handCount: 1,
        },
      ],
    },
  };
  await page.getByTestId('import-file').setInputFiles({
    name: 'h.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)),
  });
  await expect(page.getByTestId('scoreboard')).toBeVisible();
  await page.getByTestId('cumulative-btn').click();
  await expect(page.getByTestId('archive-list')).toContainText('5. juni');
});

test('a failed write is visible and nothing is recorded; archiving keeps earlier evenings', async ({ page }) => {
  await page.goto('/?e2e=writefail');
  await page.getByTestId('new-hand-btn').click();
  await page.getByTestId('save-hand').click();
  await expect(page.getByTestId('save-error')).toBeVisible();
  await page.getByTestId('cancel-hand').click();
  await expect(page.getByTestId('hand-count')).toHaveText('Spil i alt: 0');

  // Normal path: record, archive, record again, archive again -> both evenings kept.
  await page.goto('/');
  for (let i = 0; i < 2; i++) {
    await page.getByTestId('new-hand-btn').click();
    await page.getByTestId('save-hand').click();
    await expect(page.getByTestId('hand-count')).toHaveText('Spil i alt: 1');
    await page.getByTestId('archive-btn').click();
    await page.getByRole('button', { name: 'Arkivér', exact: true }).click();
    await expect(page.getByTestId('hand-count')).toHaveText('Spil i alt: 0');
  }
  await page.getByTestId('cumulative-btn').click();
  await expect(page.locator('.archive-actions')).toHaveCount(2);
});
