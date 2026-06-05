import React, { useState } from 'react';
import { useAppState } from '../state/AppStateContext.jsx';
import { sortedByScore, totalsAreZeroSum } from '../state/selectors.js';
import { buildScoreText } from '../state/report.js';
import { copyText, downloadTextFile, backupFilename } from '../lib/browser.js';
import HandHistory from './HandHistory.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import ImportDialog from './ImportDialog.jsx';
import ScoringRules from './ScoringRules.jsx';
import SharedBar from './SharedBar.jsx';
import CumulativeHistory from './CumulativeHistory.jsx';

function signed(v) {
  if (v > 0) return `+${v}`;
  return `${v}`; // 0 -> "0", negatives keep their sign
}

export default function Scoreboard({ onNewHand, onOpenSessions }) {
  const { activeSession, totals, lastSavedAt, saveError, isShared, canEdit, actions } = useAppState();
  const [confirm, setConfirm] = useState(null); // 'reset' | 'archive' | null
  const [importOpen, setImportOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [cumOpen, setCumOpen] = useState(false);
  const [toast, setToast] = useState(null);

  function flash(msg) {
    setToast(msg);
    window.clearTimeout(flash._t);
    flash._t = window.setTimeout(() => setToast(null), 3000);
  }

  // In shared mode the session may briefly be null while connecting.
  if (!activeSession) {
    return (
      <div className="screen" data-testid="scoreboard">
        <header className="screen-header column">
          <h1 data-testid="app-title">Jungs-Jydewhist</h1>
        </header>
        <SharedBar />
        {isShared && <p className="note">Forbinder til delt spil…</p>}
      </div>
    );
  }

  const order = sortedByScore(totals);
  const zeroSum = totalsAreZeroSum(totals);
  const handCount = activeSession.hands.length;

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
        <button className="session-name" onClick={onOpenSessions} disabled={isShared} data-testid="active-session-name">
          {activeSession.name} {!isShared && '▾'}
        </button>
        {!isShared && (
          <div className="saved-indicator" data-testid="saved-indicator">
            {saveError ? (
              <span className="bad">⚠ {saveError}</span>
            ) : lastSavedAt ? (
              <span className="ok">✓ Gemt lokalt kl. {lastSavedAt.toLocaleTimeString('da-DK')}</span>
            ) : (
              <span>Gemmes lokalt i denne browser</span>
            )}
          </div>
        )}
      </header>

      <SharedBar />

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
        {canEdit && (
          <>
            <button className="btn btn-primary big" onClick={onNewHand} data-testid="new-hand-btn">
              Nyt spil
            </button>
            {isShared && (
              <button
                className="btn btn-primary"
                onClick={() => setConfirm('archive')}
                disabled={handCount === 0}
                data-testid="archive-btn"
              >
                Arkivér aften og start ny
              </button>
            )}
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

        {!isShared && (
          <>
            <button className="btn btn-secondary" onClick={() => actions.createSession()} data-testid="new-session-btn">
              Ny session
            </button>
            <button className="btn btn-secondary" onClick={onOpenSessions} data-testid="choose-session-btn">
              Vælg session
            </button>
            <button className="btn btn-secondary" onClick={handleExport} data-testid="export-btn">
              Eksportér backup
            </button>
            <button className="btn btn-secondary" onClick={() => setImportOpen(true)} data-testid="import-btn">
              Importér backup
            </button>
          </>
        )}

        {isShared && (
          <button className="btn btn-secondary" onClick={() => setCumOpen(true)} data-testid="cumulative-btn">
            Samlet historik
          </button>
        )}
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
          message={
            isShared
              ? 'Dette rydder den aktive aften UDEN at arkivere den (scoren går tabt). Vil du gemme aftenen, så brug i stedet “Arkivér aften og start ny”.'
              : `Alle ${handCount} spil i "${activeSession.name}" slettes.`
          }
          confirmLabel="Nulstil uden at arkivere"
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

      {cumOpen && <CumulativeHistory onClose={() => setCumOpen(false)} />}
    </div>
  );
}
