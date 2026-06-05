import React, { useState } from 'react';
import Modal from './Modal.jsx';
import { useAppState } from '../state/AppStateContext.jsx';

// Enter a room code to join a shared game as a (read-only) viewer or, if you are
// the host on this device, as host.
export default function JoinSharedDialog({ onClose }) {
  const { actions } = useAppState();
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleJoin() {
    setBusy(true);
    setError(null);
    const res = await actions.joinShared(code);
    setBusy(false);
    if (!res.ok) {
      setError(res.error || 'Kunne ikke deltage.');
      return;
    }
    onClose();
  }

  return (
    <Modal title="Deltag i delt spil" onClose={onClose} testId="join-dialog">
      <p className="note">Indtast koden du har fået fra værten (fx K7Q2MP).</p>
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
          onClick={handleJoin}
          disabled={busy || !code.trim()}
          data-testid="join-confirm"
        >
          {busy ? 'Forbinder…' : 'Deltag'}
        </button>
      </div>
    </Modal>
  );
}
