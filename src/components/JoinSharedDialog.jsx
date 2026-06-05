import React, { useState } from 'react';
import Modal from './Modal.jsx';
import { useAppState } from '../state/AppStateContext.jsx';
import { getRecentSharedRooms } from '../lib/sharedMeta.js';

// Join a shared game: pick a recent room (no code needed) or type a room code.
export default function JoinSharedDialog({ onClose }) {
  const { actions } = useAppState();
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const recent = getRecentSharedRooms();

  async function joinCode(value) {
    setBusy(true);
    setError(null);
    const res = await actions.joinShared(value);
    setBusy(false);
    if (!res.ok) {
      setError(res.error || 'Kunne ikke deltage.');
      return;
    }
    onClose();
  }

  return (
    <Modal title="Deltag i delt spil" onClose={onClose} testId="join-dialog">
      {recent.length > 0 && (
        <div className="recent-rooms" data-testid="recent-rooms">
          <p className="field-label">Seneste delte spil</p>
          {recent.map((r) => (
            <button
              key={r.roomCode}
              className="btn btn-secondary recent-room"
              disabled={busy}
              onClick={() => joinCode(r.roomCode)}
              data-testid={`recent-${r.roomCode}`}
            >
              {r.sessionName ? `${r.sessionName} · ` : ''}{r.roomCode}
            </button>
          ))}
        </div>
      )}

      <p className="note">Eller indtast en kode fra værten (fx K7Q2MP).</p>
      <input
        className="input"
        placeholder="Kode"
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
          setError(null);
        }}
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        data-testid="join-code-input"
      />
      {error && <p className="error" data-testid="join-error">{error}</p>}

      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={onClose}>Annuller</button>
        <button
          className="btn btn-primary"
          onClick={() => joinCode(code)}
          disabled={busy || !code.trim()}
          data-testid="join-confirm"
        >
          {busy ? 'Forbinder…' : 'Deltag'}
        </button>
      </div>
    </Modal>
  );
}
