import React, { useState } from 'react';
import { summarizeHand } from '../lib/scoring.js';
import { handsWithDisplayNumbers } from '../state/selectors.js';
import ConfirmDialog from './ConfirmDialog.jsx';

// Compact chronological hand history (newest first). Display numbers are derived
// from chronological position, so deleting a hand renumbers the rest.
export default function HandHistory({ session, onDeleteHand }) {
  const [confirmId, setConfirmId] = useState(null);
  const rows = handsWithDisplayNumbers(session.hands, true); // newest first

  return (
    <section className="history" data-testid="hand-history">
      <h2 className="history-title">Historik</h2>
      {rows.length === 0 ? (
        <p className="note">Ingen spil endnu.</p>
      ) : (
        <ul className="history-list">
          {rows.map(({ hand, displayNumber }) => (
            <li key={hand.id} className="history-item">
              <span className="history-text">
                {summarizeHand(hand, displayNumber)}
                {hand.manualOverride && <em className="manual-badge"> (manuel)</em>}
              </span>
              <button
                className="btn btn-icon btn-danger-outline"
                onClick={() => setConfirmId(hand.id)}
                aria-label={`Slet spil #${displayNumber}`}
                data-testid={`delete-hand-${displayNumber}`}
              >
                Slet
              </button>
            </li>
          ))}
        </ul>
      )}

      {confirmId && (
        <ConfirmDialog
          title="Slet spil?"
          message="Spillet fjernes og totalerne genberegnes."
          confirmLabel="Slet"
          danger
          onConfirm={() => {
            onDeleteHand(confirmId);
            setConfirmId(null);
          }}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </section>
  );
}
