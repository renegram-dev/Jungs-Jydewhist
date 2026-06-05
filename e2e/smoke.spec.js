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
