import React, { useState } from 'react';
import { useAppState } from '../state/AppStateContext.jsx';
import { sortedByScore, totalsAreZeroSum } from '../state/selectors.js';
import { buildScoreText } from '../state/report.js';
import { copyText } from '../lib/browser.js';
import HandHistory from './HandHistory.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import ScoringRules from './ScoringRules.jsx';
import { AccountBar } from './HistoryGate.jsx';
import CumulativeHistory from './CumulativeHistory.jsx';
import { MEDALS } from '../lib/sharedGameUtils.js';

function signed(v) {
  if (v > 0) return `+${v}`;
  return `${v}`; // 0 -> "0", negatives keep their sign
}

export default function Scoreboard({ onNewHand }) {
  const { activeSession, totals, canEdit, writeError, provisionalMedals, actions } = useAppState();
  const [confirm, setConfirm] = useState(null); // 'reset' | 'archive' | null
  const [rulesOpen, setRulesOpen] = useState(false);
  const [cumOpen, setCumOpen] = useState(false);
  const [toast, setToast] = useState(null);

  function flash(msg) {
    setToast(msg);
    window.clearTimeout(flash._t);
    flash._t = window.setTimeout(() => setToast(null), 3000);
  }

  // App.jsx only renders the scoreboard from a server-confirmed document.
  if (!activeSession) return null;

  const order = sortedByScore(totals);
  const zeroSum = totalsAreZeroSum(totals);
  const handCount = activeSession.hands.length;

  async function handleCopy() {
    const ok = await copyText(buildScoreText(activeSession));
    flash(ok ? 'Score kopieret til udklipsholder' : 'Kunne ikke kopiere');
  }

  return (
    <div className="screen" data-testid="scoreboard">
      <header className="screen-header column">
        <h1 data-testid="app-title">Jungs-Jydewhist</h1>
        <div className="session-name" data-testid="active-session-name">{activeSession.name}</div>
      </header>

      <AccountBar />

      {writeError && (
        <div className="warning" role="alert" data-testid="write-error">
          ⚠ Ikke gemt: {writeError}{' '}
          <button className="btn btn-secondary btn-icon" onClick={actions.dismissWriteError}>OK</button>
        </div>
      )}

      {!zeroSum && (
        <div className="warning" data-testid="zero-sum-warning">
          ⚠ Advarsel: totalerne går ikke op i nul. Tjek hånd-historikken.
        </div>
      )}

      <table className="scoreboard-table" data-testid="scoreboard-table">
        <tbody>
          {order.map((p) => (
            <tr key={p}>
              <td className="sb-name">
                {p}
                {provisionalMedals && (
                  <span className="prov-medal" data-testid={`prov-${p}`}>
                    Står til {MEDALS[provisionalMedals[p]].emoji}
                  </span>
                )}
              </td>
              <td className={`sb-total ${totals[p] >= 0 ? 'pos' : 'neg'}`} data-testid={`total-${p}`}>
                {signed(totals[p])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="hand-count" data-testid="hand-count">
        Spil i alt: {handCount}
      </p>

      {toast && <div className="toast" data-testid="toast">{toast}</div>}

      <div className="button-grid">
        {canEdit && (
          <>
            <button className="btn btn-primary big" onClick={onNewHand} data-testid="new-hand-btn">
              Nyt spil
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setConfirm('archive')}
              disabled={handCount === 0}
              data-testid="archive-btn"
            >
              Arkivér aften og start ny
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => actions.undoLast()}
              disabled={handCount === 0}
              data-testid="undo-btn"
            >
              Fortryd seneste spil
            </button>
            <button
              className="btn btn-danger"
              onClick={() => setConfirm('reset')}
              disabled={handCount === 0}
              data-testid="reset-btn"
            >
              Nulstil aktuel session
            </button>
          </>
        )}

        <button className="btn btn-secondary" onClick={() => setCumOpen(true)} data-testid="cumulative-btn">
          Samlet historik
        </button>
        <button className="btn btn-secondary" onClick={handleCopy} data-testid="copy-btn">
          Kopiér score
        </button>
        <button className="btn btn-secondary" onClick={() => setRulesOpen(true)} data-testid="rules-btn">
          Scoringsregler
        </button>
      </div>

      <HandHistory session={activeSession} canEdit={canEdit} onDeleteHand={(id) => actions.deleteHand(id)} />

      {confirm === 'archive' && (
        <ConfirmDialog
          title="Arkivér aften og start ny?"
          message={`Aftenen "${activeSession.name}" med ${handCount} spil gemmes i Samlet historik, og der startes en ny aften. Den samlede stilling bevares.`}
          confirmLabel="Arkivér"
          onConfirm={async () => {
            const r = await actions.archiveSession();
            setConfirm(null);
            flash(r && r.ok ? 'Aften arkiveret — ny aften startet' : (r && r.error) || 'Kunne ikke arkivere');
          }}
          onCancel={() => setConfirm(null)}
        />
      )}

      {confirm === 'reset' && (
        <ConfirmDialog
          title="Nulstil aktuel session?"
          message="Dette rydder den aktive aften UDEN at arkivere den (scoren går tabt). Vil du gemme aftenen, så brug i stedet “Arkivér aften og start ny”."
          confirmLabel="Nulstil uden at arkivere"
          danger
          onConfirm={async () => {
            const r = await actions.clearSession();
            setConfirm(null);
            flash(r.ok ? 'Sessionen er nulstillet' : 'Kunne ikke nulstille');
          }}
          onCancel={() => setConfirm(null)}
        />
      )}

      {rulesOpen && <ScoringRules onClose={() => setRulesOpen(false)} />}

      {cumOpen && <CumulativeHistory onClose={() => setCumOpen(false)} />}
    </div>
  );
}
