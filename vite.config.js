import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// App version (from package.json) + short git commit as the build id. These are
// injected into the bundle via `define` and written to version.json (below) so a
// running (possibly cached / home-screen) app can detect a newer deployed build.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));
const APP_VERSION = pkg.version;
let APP_BUILD = 'local';
try {
  APP_BUILD = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
    .toString()
    .trim();
} catch {
  // not a git checkout — keep the fallback
}
const APP_BUILD_TIME = new Date().toISOString();

// Emit a fresh version.json into the build output (served at <base>/version.json)
// so the update check can compare the deployed build to the running one.
function emitVersionJson() {
  return {
    name: 'emit-version-json',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: APP_VERSION, build: APP_BUILD, updatedAt: APP_BUILD_TIME }, null, 2),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), emitVersionJson()],
  // base: '/' for local dev / root hosts. For GitHub Pages set DEPLOY_BASE to
  // '/<repo-name>/' (the Actions workflow uses '/Jungs-Jydewhist/').
  base: process.env.DEPLOY_BASE || '/',
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __APP_BUILD__: JSON.stringify(APP_BUILD),
    __APP_BUILD_TIME__: JSON.stringify(APP_BUILD_TIME),
  },
  server: {
    host: '0.0.0.0', // reachable from iPhone on the same Wi-Fi
    port: 5173,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
  // Vitest config (pure-logic unit tests).
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.js'],
    globals: true,
  },
});
