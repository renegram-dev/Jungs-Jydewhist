import React, { useState } from 'react';
import Modal from './Modal.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import ImportDialog from './ImportDialog.jsx';
import { useAppState } from '../state/AppStateContext.jsx';
import { downloadTextFile, backupFilename } from '../lib/browser.js';

function fmt(iso) {
  try {
    return new Date(iso).toLocaleString('da-DK');
  } catch {
    return iso;
  }
}

export default function SessionManager({ onClose }) {
  const { state, actions } = useAppState();
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [confirmId, setConfirmId] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

  const sessions = [...state.sessions].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

  function startRename(s) {
    setEditingId(s.id);
    setEditName(s.name);
  }
  function saveRename() {
    actions.renameSession(editingId, editName);
    setEditingId(null);
  }

  return (
    <Modal title="Sessioner" onClose={onClose} testId="session-manager">
      <div className="session-toolbar">
        <button className="btn btn-primary" onClick={() => actions.createSession()} data-testid="sm-new-session">
          Ny session
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => downloadTextFile(backupFilename('jungs-jydewhist-alle'), actions.exportBackup())}
        >
          Eksportér backup
        </button>
        <button className="btn btn-secondary" onClick={() => setImportOpen(true)}>
          Importér backup
        </button>
      </div>

      <p className="note">
        Data gemmes kun lokalt pr. browser/URL. Skifter du adresse eller enhed
        (fx fra PC'ens lokale URL til den faste web-adresse): eksportér her og
        importér på den nye adresse.
      </p>

      <ul className="session-list" data-testid="session-list">
        {sessions.map((s) => {
          const active = s.id === state.activeSessionId;
          return (
            <li key={s.id} className={`session-item ${active ? 'active' : ''}`}>
              {editingId === s.id ? (
                <div className="session-rename">
                  <input
                    className="input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    autoFocus
                  />
                  <div className="row-actions">
                    <button className="btn btn-primary" onClick={saveRename}>Gem</button>
                    <button className="btn btn-secondary" onClick={() => setEditingId(null)}>Annuller</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="session-meta">
                    <div className="session-title">
                      {s.name} {active && <span className="badge">aktiv</span>}
                    </div>
                    <div className="session-sub">
                      {s.hands.length} spil · opdateret {fmt(s.updatedAt)}
                    </div>
                  </div>
                  <div className="row-actions">
                    {!active && (
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          actions.selectSession(s.id);
                          onClose();
                        }}
                      >
                        Vælg
                      </button>
                    )}
                    <button className="btn btn-secondary" onClick={() => startRename(s)}>Omdøb</button>
                    <button className="btn btn-danger-outline" onClick={() => setConfirmId(s.id)}>Slet</button>
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>

      {confirmId && (
        <ConfirmDialog
          title="Slet session?"
          message="Hele sessionen og dens historik slettes permanent."
          confirmLabel="Slet"
          danger
          onConfirm={() => {
            actions.deleteSession(confirmId);
            setConfirmId(null);
          }}
          onCancel={() => setConfirmId(null)}
        />
      )}

      {importOpen && (
        <ImportDialog onClose={() => setImportOpen(false)} onImported={() => setImportOpen(false)} />
      )}
    </Modal>
  );
}
