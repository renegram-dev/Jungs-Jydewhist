import React, { useState } from 'react';
import Modal from './Modal.jsx';
import { useAppState } from '../state/AppStateContext.jsx';
import { readFileAsText } from '../lib/browser.js';

// Import a backup (paste JSON or pick a file). Always imported as a NEW session;
// existing sessions are never overwritten. Invalid data is rejected with a message.
export default function ImportDialog({ onClose, onImported }) {
  const { actions } = useAppState();
  const [text, setText] = useState('');
  const [error, setError] = useState(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const content = await readFileAsText(file);
      setText(content);
      setError(null);
    } catch {
      setError('Kunne ikke læse filen.');
    }
  }

  function handleImport() {
    const res = actions.importBackup(text);
    if (!res.ok) {
      setError(res.error || 'Import mislykkedes.');
      return;
    }
    const imported = res.state.sessions.find((s) => s.id === res.state.activeSessionId);
    onImported(imported ? imported.name : 'session');
  }

  return (
    <Modal title="Importér backup" onClose={onClose} testId="import-dialog">
      <p className="note">
        Indsæt backup-JSON eller vælg en fil. Data importeres som en <strong>ny session</strong> –
        dine eksisterende sessioner overskrives ikke. Spillerne skal være René, Thomas, Carsten, Tom.
      </p>

      <input type="file" accept="application/json,.json" onChange={handleFile} className="file-input" />

      <textarea
        className="input textarea"
        placeholder="Indsæt JSON her…"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
        rows={8}
        data-testid="import-textarea"
      />

      {error && <p className="error" data-testid="import-error">{error}</p>}

      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={onClose}>Annuller</button>
        <button
          className="btn btn-primary"
          onClick={handleImport}
          disabled={!text.trim()}
          data-testid="import-confirm"
        >
          Importér
        </button>
      </div>
    </Modal>
  );
}
