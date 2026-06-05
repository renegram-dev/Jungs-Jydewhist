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

  // 4) Reload — the saved score still shows (localStorage persistence).
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
});

// Firebase is configured, so the shared-mode controls are offered in local mode.
// We do NOT connect to Firestore here (that needs real network + published rules
// + two devices) — live shared sync is a manual test, see
// docs/validation-checklist.md. This just verifies the local/configured UI state.
test('shared mode controls are available in local mode (no live connect)', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('mode-badge')).toHaveText('Lokal');
  await expect(page.getByTestId('start-shared-btn')).toBeVisible();
  await expect(page.getByTestId('join-shared-btn')).toBeVisible();
  // Local editing still works (canEdit is true in local mode).
  await expect(page.getByTestId('new-hand-btn')).toBeVisible();
});
