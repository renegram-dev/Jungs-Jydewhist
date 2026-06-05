import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { AppStateProvider } from './state/AppStateContext.jsx';
import './index.css';

// This app intentionally has NO service worker — freshness matters more than
// offline caching. Defensively unregister any stray SW (e.g. from a past
// experiment) so it can't keep serving a cached app shell.
if ('serviceWorker' in navigator && navigator.serviceWorker.getRegistrations) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => regs.forEach((r) => r.unregister()))
    .catch(() => {});
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppStateProvider>
      <App />
    </AppStateProvider>
  </React.StrictMode>,
);
