import React from 'react';
import { PLAYERS } from '../lib/scoring.js';

function signed(v) {
  return v > 0 ? `+${v}` : `${v}`;
}

// Live preview of the score for the hand being entered.
// `delta` is the effective delta (manual override if active, else calc.delta).
export default function ScorePreview({ calc, delta, manualOverride }) {
  const isSolo = calc.requiredTricks === null;
  return (
    <div className={`preview ${calc.success ? 'preview-win' : 'preview-loss'}`} data-testid="score-preview">
      <div className="preview-result" data-testid="preview-result">
        {calc.success ? 'Vundet' : 'Tabt'}
      </div>
      <ul className="preview-facts">
        {!isSolo && (
          <li>
            Krævede stik: <strong>{calc.requiredTricks}</strong>
          </li>
        )}
        <li>
          Faktiske stik: <strong>{calc.actualTricks}</strong>
        </li>
        <li>
          Grundpoint: <strong>{calc.basePoints}</strong>
        </li>
        {calc.success && calc.overtricks > 0 && (
          <li>
            Overstik: <strong>+{calc.overtricks}</strong> (à 1)
          </li>
        )}
        {!calc.success && calc.undertricks > 0 && (
          <li>
            Understik: <strong>{calc.undertricks}</strong> (à 5)
          </li>
        )}
        <li>
          Spilpoint: <strong>{calc.handPoints}</strong>
        </li>
      </ul>

      <div className="preview-deltas" data-testid="preview-deltas">
        {PLAYERS.map((p) => (
          <div key={p} className={`delta-chip ${(delta[p] ?? 0) >= 0 ? 'pos' : 'neg'}`}>
            <span className="delta-name">{p}</span>
            <span className="delta-value" data-testid={`preview-delta-${p}`}>
              {signed(delta[p] ?? 0)}
            </span>
          </div>
        ))}
      </div>

      <p className="preview-explanation">
        {manualOverride ? 'Manuel score brugt. ' : ''}
        {calc.explanation}
      </p>
    </div>
  );
}
