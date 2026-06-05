import React, { useState } from 'react';
import { useAppState } from '../state/AppStateContext.jsx';
import { sortedByScore, totalsAreZeroSum } from '../state/selectors.js';
import { buildScoreText } from '../state/report.js';
import { copyText, downloadTextFile, backupFilename } from '../lib/browser.js';
import HandHistory from './HandHistory.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import ImportDialog from './ImportDialog.jsx';
import ScoringRules from './ScoringRules.jsx';

function signed(v) {
  if (v > 0) return `+${v}`;
  return `${v}`; // 0 -> "0", negatives keep their sign
}

export default function Scoreboard({ onNewHand, onOpenSessions }) {
  const { activeSession, totals, lastSavedAt, saveError, actions } = useAppState();
  const [confirm, setConfirm] = useState(null); // 'reset' | null
  const [importOpen, setImportOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [toast, setToast] = useState(null);

  if (!activeSession) return null;

  const order = sortedByScore(totals);
  const zeroSum = totalsAreZeroSum(totals);
  const handCount = activeSession.hands.length;

  function flash(msg) {
    setToast(msg);
    window.clearTimeout(flash._t);
    flash._t = window.setTimeout(() => setToast(null), 3000);
  }

  async function handleCopy() {
    const ok = await copyText(buildScoreText(activeSession));
    flash(ok ? 'Score kopieret til udklipsholder' : 'Kunne ikke kopiere');
  }

  function handleExport() {
    downloadTextFile(backupFilename(activeSession.name), actions.exportBackup());
    flash('Backup downloadet');
  }

  return (
    <div className="screen" data-testid="scoreboard">
      <header className="screen-header column">
        <h1 data-testid="app-title">Jungs-Jydewhist</h1>
        <button className="session-name" onClick={onOpenSessions} data-testid="active-session-name">
          {activeSession.name} ▾
        </button>
        <div className="saved-indicator" data-testid="saved-indicator">
          {saveError ? (
            <span className="bad">⚠ {saveError}</span>
          ) : lastSavedAt ? (
            <span className="ok">✓ Gemt lokalt kl. {lastSavedAt.toLocaleTimeString('da-DK')}</span>
          ) : (
            <span>Gemmes lokalt i denne browser</span>
          )}
        </div>
      </header>

      {!zeroSum && (
        <div className="warning" data-testid="zero-sum-warning">
          ⚠ Advarsel: totalerne går ikke op i nul. Tjek hånd-historikken.
        </div>
      )}

      <table className="scoreboard-table" data-testid="scoreboard-table">
        <tbody>
          {order.map((p) => (
            <tr key={p}>
              <td className="sb-name">{p}</td>
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
        <button className="btn btn-primary big" onClick={onNewHand} data-testid="new-hand-btn">
          Nyt spil
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
        <button className="btn btn-secondary" onClick={() => actions.createSession()} data-testid="new-session-btn">
          Ny session
        </button>
        <button className="btn btn-secondary" onClick={onOpenSessions} data-testid="choose-session-btn">
          Vælg session
        </button>
        <button className="btn btn-secondary" onClick={handleCopy} data-testid="copy-btn">
          Kopiér score
        </button>
        <button className="btn btn-secondary" onClick={handleExport} data-testid="export-btn">
          Eksportér backup
        </button>
        <button className="btn btn-secondary" onClick={() => setImportOpen(true)} data-testid="import-btn">
          Importér backup
        </button>
        <button className="btn btn-secondary" onClick={() => setRulesOpen(true)} data-testid="rules-btn">
          Scoringsregler
        </button>
      </div>

      <HandHistory session={activeSession} onDeleteHand={(id) => actions.deleteHand(id)} />

      {confirm === 'reset' && (
        <ConfirmDialog
          title="Nulstil aktuel session?"
          message={`Alle ${handCount} spil i "${activeSession.name}" slettes. Spillets navn og spillere beholdes.`}
          confirmLabel="Nulstil"
          danger
          onConfirm={() => {
            actions.clearSession();
            setConfirm(null);
            flash('Sessionen er nulstillet');
          }}
          onCancel={() => setConfirm(null)}
        />
      )}

      {importOpen && (
        <ImportDialog
          onClose={() => setImportOpen(false)}
          onImported={(name) => {
            setImportOpen(false);
            flash(`Importeret som ny session: ${name}`);
          }}
        />
      )}

      {rulesOpen && <ScoringRules onClose={() => setRulesOpen(false)} />}
    </div>
  );
}
