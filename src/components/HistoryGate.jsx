import React, { useRef, useState } from 'react';
import { useAppState } from '../state/AppStateContext.jsx';
import { readFileAsText, downloadTextFile, backupFilename } from '../lib/browser.js';

function Shell({ children, testId }) {
  return (
    <div className="screen" data-testid={testId}>
      <header className="screen-header column">
        <h1 data-testid="app-title">Jungs-Jydewhist</h1>
      </header>
      {children}
    </div>
  );
}

export function Splash({ text, testId = 'splash' }) {
  return (
    <Shell testId={testId}>
      <p className="note" data-testid="splash-text">{text}</p>
    </Shell>
  );
}

export function LoginScreen() {
  const { actions, authError, firebaseReady } = useAppState();
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    await actions.signIn();
    setBusy(false);
  }

  return (
    <Shell testId="login-screen">
      <p className="note">Log ind med Google for at se og redigere historikken.</p>
      {!firebaseReady && (
        <p className="error" data-testid="login-error">Firebase er ikke konfigureret.</p>
      )}
      {authError && <p className="error" data-testid="login-error">{authError}</p>}
      <div className="button-grid">
        <button
          className="btn btn-primary big"
          onClick={go}
          disabled={busy || !firebaseReady}
          data-testid="google-login-btn"
        >
          {busy ? 'Logger ind…' : 'Log ind med Google'}
        </button>
      </div>
      <LegacyLocalExport />
    </Shell>
  );
}

// Shown when the cloud history cannot be shown (error) — never an empty scoreboard.
export function ErrorScreen() {
  const { dataError, actions } = useAppState();
  return (
    <Shell testId="error-screen">
      <div className="warning" data-testid="error-message">
        ⚠ Kunne ikke hente historikken: {dataError || 'ukendt fejl'}
      </div>
      <p className="note">Der vises ingen point, før forbindelsen til skyen er bekræftet.</p>
      <div className="button-grid">
        <button className="btn btn-primary" onClick={actions.retry} data-testid="retry-btn">
          Prøv igen
        </button>
        <button className="btn btn-secondary" onClick={actions.signOut} data-testid="logout-btn">
          Log ud
        </button>
      </div>
    </Shell>
  );
}

// Opaque full-screen block while the connection is not server-confirmed. The app
// stays mounted underneath (so a half-entered hand is not lost) but is not visible.
export function ConnectionOverlay() {
  const { actions } = useAppState();
  return (
    <div className="conn-overlay" role="alert" data-testid="offline-overlay">
      <h1>Jungs-Jydewhist</h1>
      <div className="warning">⚠ Ingen forbindelse til skyen. Point og historik vises ikke, og intet kan gemmes.</div>
      <p className="note">Appen kræver internet. Den fortsætter automatisk, når forbindelsen er tilbage.</p>
      <button className="btn btn-secondary" onClick={actions.retry}>Prøv igen</button>
    </div>
  );
}

// history/main does not exist in the cloud: never shown as an empty history.
// Recovery: import a previously exported JSON file (create-only).
export function MissingHistory() {
  const { actions } = useAppState();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function onFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const res = await actions.importHistory(await readFileAsText(file));
      if (!res.ok) setError(res.error);
    } catch (err) {
      setError(err.message || 'Kunne ikke læse filen.');
    }
    setBusy(false);
    e.target.value = '';
  }

  return (
    <Shell testId="missing-screen">
      <div className="warning" data-testid="missing-message">
        ⚠ Historikken findes ikke i skyen. Dette er IKKE en tom historik — der er ikke oprettet nogen endnu.
      </div>
      <p className="note">Gendan fra en eksporteret JSON-fil (se docs/cloud-setup.md).</p>
      {error && <p className="error" data-testid="import-error">{error}</p>}
      <div className="button-grid">
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} data-testid="import-file" />
        <button
          className="btn btn-primary big"
          onClick={() => fileRef.current && fileRef.current.click()}
          disabled={busy}
          data-testid="import-btn"
        >
          {busy ? 'Importerer…' : 'Importér historik (JSON)'}
        </button>
        <button className="btn btn-secondary" onClick={actions.signOut}>Log ud</button>
      </div>
    </Shell>
  );
}

// Old local-mode data (pre-cloud) is never read or shown, but it stays in this
// browser's localStorage. If any exists, offer a raw download so it can't be lost.
const LEGACY_LOCAL_KEY = 'jungs-jydewhist.v1';
export function LegacyLocalExport() {
  let raw = null;
  try {
    raw = localStorage.getItem(LEGACY_LOCAL_KEY);
  } catch {
    // ignore
  }
  if (!raw) return null;
  return (
    <p className="note" data-testid="legacy-local">
      Der ligger gamle lokale data i denne browser.{' '}
      <button
        className="btn btn-secondary btn-icon"
        onClick={() => downloadTextFile(backupFilename('jungs-jydewhist-gammel-lokal'), raw)}
      >
        Download dem (JSON)
      </button>
    </p>
  );
}

// Small account section on the scoreboard: export + sign out.
export function AccountBar() {
  const { actions } = useAppState();
  const [toast, setToast] = useState(null);

  function exportNow() {
    const text = actions.exportHistory();
    if (!text) return;
    downloadTextFile(backupFilename('jungs-jydewhist-historik'), text);
    setToast('Historik downloadet');
    window.clearTimeout(exportNow._t);
    exportNow._t = window.setTimeout(() => setToast(null), 2500);
  }

  return (
    <div className="shared-bar" data-testid="account-bar">
      <div className="shared-head">
        <span className="badge mode-badge shared" data-testid="mode-badge">Sky</span>
        <span className="conn connected" data-testid="conn-status">Synkroniseret</span>
      </div>
      <div className="shared-actions">
        <button className="btn btn-secondary" onClick={exportNow} data-testid="export-btn">
          Eksportér historik
        </button>
        <button className="btn btn-secondary" onClick={actions.signOut} data-testid="logout-btn">
          Log ud
        </button>
      </div>
      <LegacyLocalExport />
      {toast && <div className="toast" data-testid="shared-toast">{toast}</div>}
    </div>
  );
}
