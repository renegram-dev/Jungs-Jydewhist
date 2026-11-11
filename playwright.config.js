import { defineConfig, devices } from '@playwright/test';

// Minimal smoke runner. Auto-starts the Vite dev server and drives Chromium.
// Runs against a test-only in-memory history store (VITE_E2E=1, set below) — no
// Firebase needed. Each test gets a fresh browser context, so runs are clean.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx vite --port 5173 --strictPort',
    env: { VITE_E2E: '1' },
    url: 'http://localhost:5173',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
