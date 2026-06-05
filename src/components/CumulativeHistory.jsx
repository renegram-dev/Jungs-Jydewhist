import React, { useState } from 'react';
import Modal from './Modal.jsx';
import { useAppState } from '../state/AppStateContext.jsx';
import { sortedByScore, totalsAreZeroSum, handsWithDisplayNumbers } from '../state/selectors.js';
import { summarizeHand } from '../lib/scoring.js';

function signed(v) {
  return v > 0 ? `+${v}` : `${v}`;
}
function fmt(iso) {
  try {
    return new Date(iso).toLocaleString('da-DK');
  } catch {
    return iso;
  }
}

function TotalsRow({ totals }) {
  const order = sortedByScore(totals);
  return (
    <div className="cum-totals">
      {order.map((p) => (
        <div key={p} className="cum-cell">
          <span className="cum-name">{p}</span>
          <span className={`cum-val ${totals[p] >= 0 ? 'pos' : 'neg'}`}>{signed(totals[p])}</span>
        </div>
      ))}
    </div>
  );
}

// Read-only long-term history for a shared room: cumulative score across all
// archived evenings + the current one, plus the per-evening breakdown.
export default function CumulativeHistory({ onClose }) {
  const { archivedSessions, cumulativeTotals, activeSession, totals } = useAppState();
  const [openId, setOpenId] = useState(null);
  const cumZero = totalsAreZeroSum(cumulativeTotals);
  const currentHands = activeSession ? activeSession.hands.length : 0;

  return (
    <Modal title="Samlet historik" onClose={onClose} testId="cumulative-history">
      <section className="cum-section">
        <h3>Samlet stilling (alle aftener)</h3>
        {!cumZero && (
          <div className="warning" data-testid="cum-zero-sum-warning">
            ⚠ Samlet total går ikke op i nul.
          </div>
        )}
        <TotalsRow totals={cumulativeTotals} />
      </section>

      <section className="cum-section">
        <h3>Aktuel aften{activeSession ? ` — ${activeSession.name}` : ''}</h3>
        <p className="note">{currentHands} spil (endnu ikke arkiveret)</p>
        <TotalsRow totals={totals} />
      </section>

      <section className="cum-section">
        <h3>Arkiverede aftener ({archivedSessions.length})</h3>
        {archivedSessions.length === 0 ? (
          <p className="note">Ingen arkiverede aftener endnu. Brug “Arkivér aften og start ny”.</p>
        ) : (
          <ul className="archive-list" data-testid="archive-list">
            {[...archivedSessions].reverse().map((a) => (
              <li key={a.id} className="archive-item">
                <button
                  className="archive-head"
                  onClick={() => setOpenId(openId === a.id ? null : a.id)}
                >
                  <span className="archive-title">{a.name}</span>
                  <span className="archive-sub">
                    {fmt(a.archivedAt)} · {a.handCount} spil {openId === a.id ? '▴' : '▾'}
                  </span>
                </button>
                <TotalsRow totals={a.totals} />
                {openId === a.id && (
                  <ul className="history-list">
                    {handsWithDisplayNumbers(a.hands, true).map(({ hand, displayNumber }) => (
                      <li key={hand.id || displayNumber} className="history-item">
                        <span className="history-text">{summarizeHand(hand, displayNumber)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="modal-actions">
        <button className="btn btn-primary" onClick={onClose}>Luk</button>
      </div>
    </Modal>
  );
}
