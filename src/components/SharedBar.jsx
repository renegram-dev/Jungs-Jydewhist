import React, { useState } from 'react';
import { useAppState } from '../state/AppStateContext.jsx';
import { copyText } from '../lib/browser.js';
import JoinSharedDialog from './JoinSharedDialog.jsx';

const STATUS_LABEL = {
  connecting: 'Forbinder…',
  connected: 'Forbundet',
  syncing: 'Synkroniserer…',
  offline: 'Offline / prøver igen',
  error: 'Fejl',
  idle: '',
};

// The "Lokalt spil / Delt spil" mode section shown on the scoreboard.
export default function SharedBar() {
  const { firebaseReady, isShared, mode, roomCode, shareLink, sharedStatus, sharedError, actions } =
    useAppState();
  const [joinOpen, setJoinOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const badge = mode === 'shared-host' ? 'Delt vært' : mode === 'shared-viewer' ? 'Delt visning' : 'Lokal';

  function flash(m) {
    setToast(m);
    window.clearTimeout(flash._t);
    flash._t = window.setTimeout(() => setToast(null), 2500);
  }

  async function start() {
    setBusy(true);
    const res = await actions.startSharedGame();
    setBusy(false);
    if (!res.ok) flash(res.error || 'Kunne ikke starte delt spil');
  }

  async function copyLink() {
    if (!shareLink) return;
    const ok = await copyText(shareLink);
    flash(ok ? 'Delt link kopieret' : 'Kunne ikke kopiere');
  }

  return (
    <div className="shared-bar" data-testid="shared-bar">
      <div className="shared-head">
        <span className={`badge mode-badge ${isShared ? 'shared' : 'local'}`} data-testid="mode-badge">
          {badge}
        </span>
        {isShared && (
          <span className={`conn ${sharedStatus}`} data-testid="conn-status">
            {sharedError ? sharedError : STATUS_LABEL[sharedStatus] || ''}
          </span>
        )}
      </div>

      {!isShared &&
        (firebaseReady ? (
          <div className="shared-actions">
            <button className="btn btn-secondary" onClick={start} disabled={busy} data-testid="start-shared-btn">
              {busy ? 'Starter…' : 'Start delt spil'}
            </button>
            <button className="btn btn-secondary" onClick={() => setJoinOpen(true)} data-testid="join-shared-btn">
              Deltag i delt spil
            </button>
          </div>
        ) : (
          <p className="note" data-testid="shared-not-configured">
            Delt spil er ikke aktiveret endnu (kræver Firebase-opsætning — se README).
          </p>
        ))}

      {isShared && (
        <div className="shared-actions">
          <div className="room-code" data-testid="room-code">
            Kode: <strong>{roomCode}</strong>
          </div>
          <button className="btn btn-secondary" onClick={copyLink} data-testid="copy-link-btn">
            Kopiér delt link
          </button>
          <button className="btn btn-danger-outline" onClick={actions.leaveShared} data-testid="leave-shared-btn">
            Forlad delt spil
          </button>
          <p className="note shared-note" data-testid="shared-note">
            Rummet er permanent. Alle med linket/koden kan se det aktuelle spil og
            den samlede historik. Kun værten kan redigere.
          </p>
        </div>
      )}

      {toast && <div className="toast" data-testid="shared-toast">{toast}</div>}
      {joinOpen && <JoinSharedDialog onClose={() => setJoinOpen(false)} />}
    </div>
  );
}
