import React, { useState } from 'react';
import Modal from './Modal.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import { useAppState } from '../state/AppStateContext.jsx';
import { sortedByScore, totalsAreZeroSum, handsWithDisplayNumbers } from '../state/selectors.js';
import { summarizeHand, PLAYERS } from '../lib/scoring.js';
import { MEDALS, medalsForArchived } from '../lib/sharedGameUtils.js';

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

// Read-only long-term history for a shared room: medal standings (ranked by medal
// points), each archived evening's medals, and the current (provisional) evening.
export default function CumulativeHistory({ onClose }) {
  const { archivedSessions, cumulativeTotals, medalStandings, activeSession, totals, canEdit, actions } =
    useAppState();
  const [openId, setOpenId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const cumZero = totalsAreZeroSum(cumulativeTotals);
  const currentHands = activeSession ? activeSession.hands.length : 0;
  const standings = medalStandings || [];

  return (
    <Modal title="Samlet historik" onClose={onClose} testId="cumulative-history">
      <section className="cum-section" data-testid="medal-standings">
        <h3>Medaljestilling</h3>
        <p className="note">
          Rangeret efter medaljepoint: 🥇 Guld 3 · 🥈 Sølv 2 · 🥉 Bronze 1 · 💩 Lort 0. Hver
          arkiveret aften giver permanente medaljer. Samlet score vises som point, men selve
          rangeringen følger medaljepoint.
        </p>
        {!cumZero && (
          <div className="warning" data-testid="cum-zero-sum-warning">
            ⚠ Samlet point-total går ikke op i nul.
          </div>
        )}
        <ol className="medal-list">
          {standings.map((row, i) => (
            <li key={row.player} className="medal-row" data-testid={`medal-row-${row.player}`}>
              <div className="medal-head">
                <span className="medal-rank">{i + 1}.</span>
                <span className="medal-name">{row.player}</span>
                <span className="medal-points" data-testid={`medal-points-${row.player}`}>
                  {row.medalPoints} point
                </span>
              </div>
              <div className="medal-counts">
                🥇 {row.counts.gold} · 🥈 {row.counts.silver} · 🥉 {row.counts.bronze} · 💩 {row.counts.poop}
              </div>
              <div className="medal-sub">
                Samlet score: <strong className={row.cumulativeScore >= 0 ? 'pos' : 'neg'}>{signed(row.cumulativeScore)}</strong>
                {row.provisional && (
                  <span className="prov-chip">
                    Står til {MEDALS[row.provisional].emoji} {MEDALS[row.provisional].label}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="cum-section">
        <h3>Aktuel aften{activeSession ? ` — ${activeSession.name}` : ''}</h3>
        <p className="note">
          {currentHands} spil{currentHands > 0 ? ' — foreløbige medaljer tæller først når aftenen arkiveres' : ' (endnu ikke arkiveret)'}
        </p>
        <TotalsRow totals={totals} />
      </section>

      <section className="cum-section">
        <h3>Arkiverede aftener ({archivedSessions.length})</h3>
        {archivedSessions.length === 0 ? (
          <p className="note">Ingen arkiverede aftener endnu. Brug “Arkivér aften og start ny”.</p>
        ) : (
          <ul className="archive-list" data-testid="archive-list">
            {[...archivedSessions].reverse().map((a) => {
              const medals = medalsForArchived(a);
              return (
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
                  <div className="archive-medals">
                    Medaljer: {PLAYERS.map((p) => `${p} ${MEDALS[medals[p]].emoji}`).join(', ')}
                  </div>
                  <TotalsRow totals={a.totals} />
                  {canEdit && (
                    <div className="archive-actions">
                      <button
                        className="btn btn-danger-outline btn-icon"
                        onClick={() => setConfirmId(a.id)}
                        data-testid={`delete-archive-${a.id}`}
                      >
                        Slet aften
                      </button>
                    </div>
                  )}
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
              );
            })}
          </ul>
        )}
      </section>

      <div className="modal-actions">
        <button className="btn btn-primary" onClick={onClose}>Luk</button>
      </div>

      {confirmId && (
        <ConfirmDialog
          title="Slet arkiveret aften?"
          message="Dette fjerner aftenen fra den samlede historik og ændrer den samlede score. Handlingen kan ikke fortrydes."
          confirmLabel="Slet aften"
          danger
          onConfirm={() => {
            actions.deleteArchived(confirmId);
            setConfirmId(null);
          }}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </Modal>
  );
}
