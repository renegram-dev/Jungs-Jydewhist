import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: '/' for local dev, root static hosts (Vercel/Netlify).
// For GitHub Pages set DEPLOY_BASE to '/<repo-name>/', e.g. '/Jungs-Jydewhist/'.
//   PowerShell:  $env:DEPLOY_BASE='/Jungs-Jydewhist/'; npm run build
export default defineConfig({
  plugins: [react()],
  base: process.env.DEPLOY_BASE || '/',
  server: {
    host: '0.0.0.0', // reachable from iPhone on the same Wi-Fi: http://<PC-LAN-IP>:5173
    port: 5173,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
  // Vitest config (pure-logic unit tests only; no DOM rendering needed).
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.js'],
    globals: true,
  },
});
