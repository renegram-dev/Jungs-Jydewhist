import React, { useEffect, useMemo, useState } from 'react';
import {
  PLAYERS,
  getContractList,
  getContract,
  calculateHandScore,
  validateScoreDelta,
} from '../lib/scoring.js';
import { makeHand } from '../lib/storage.js';
import { useAppState } from '../state/AppStateContext.jsx';
import Stepper from './Stepper.jsx';
import ScorePreview from './ScorePreview.jsx';

export default function NewHandForm({ onDone }) {
  const { actions } = useAppState();
  const contracts = getContractList();

  const [contractId, setContractId] = useState(0);
  const [declarer, setDeclarer] = useState(PLAYERS[0]);
  const [partnerMode, setPartnerMode] = useState('partner'); // 'partner' | 'self'
  const [partner, setPartner] = useState(PLAYERS[1]);
  const [tricks, setTricks] = useState(7);
  const [manualOverride, setManualOverride] = useState(false);
  const [overrideDelta, setOverrideDelta] = useState(() => zeroDelta());

  const contract = getContract(contractId);
  const isSolo = contract.isSolo;

  // Reset tricks to a sensible default when the contract changes.
  useEffect(() => {
    const c = getContract(contractId);
    if (c.isSolo) setTricks(c.type === 'rensol' ? 0 : 1);
    else setTricks(c.requiredTricks);
  }, [contractId]);

  // Keep the partner valid when the declarer changes.
  useEffect(() => {
    if (partner === declarer) setPartner(PLAYERS.find((p) => p !== declarer));
  }, [declarer, partner]);

  const safePartner = partner && partner !== declarer ? partner : PLAYERS.find((p) => p !== declarer);
  const effectiveMode = isSolo ? 'solo' : partnerMode;

  const calc = useMemo(
    () =>
      calculateHandScore({
        contractId,
        declarer,
        partnerMode: effectiveMode,
        partner: effectiveMode === 'partner' ? safePartner : null,
        tricks,
      }),
    [contractId, declarer, effectiveMode, safePartner, tricks],
  );

  const effectiveDelta = manualOverride ? overrideDelta : calc.delta;
  const overrideSum = PLAYERS.reduce((acc, p) => acc + (Number(overrideDelta[p]) || 0), 0);
  const overrideValid = !manualOverride || validateScoreDelta(overrideDelta);
  const canSave = overrideValid;

  function toggleOverride(on) {
    setManualOverride(on);
    if (on) setOverrideDelta({ ...calc.delta }); // seed from the calculated score
  }

  function setOverrideFor(player, raw) {
    const n = parseInt(raw, 10);
    setOverrideDelta((d) => ({ ...d, [player]: Number.isNaN(n) ? 0 : n }));
  }

  function handleSave() {
    if (!canSave) return;
    const hand = makeHand({
      contractId,
      declarer,
      partnerMode: effectiveMode,
      partner: effectiveMode === 'partner' ? safePartner : null,
      tricks,
      calc,
      manualOverride,
      delta: manualOverride ? overrideDelta : calc.delta,
    });
    actions.addHand(hand);
    onDone();
  }

  return (
    <div className="screen" data-testid="new-hand">
      <header className="screen-header">
        <button className="btn btn-back" onClick={onDone} aria-label="Tilbage">
          ‹ Tilbage
        </button>
        <h1>Nyt spil</h1>
      </header>

      <div className="form">
        <div className="field">
          <label className="field-label" htmlFor="declarer">Melder</label>
          <select
            id="declarer"
            className="input"
            value={declarer}
            onChange={(e) => setDeclarer(e.target.value)}
            data-testid="declarer-select"
          >
            {PLAYERS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="contract">Melding</label>
          <select
            id="contract"
            className="input"
            value={contractId}
            onChange={(e) => setContractId(Number(e.target.value))}
            data-testid="contract-select"
          >
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>

        {isSolo ? (
          <div className="field">
            <span className="field-label">Makker</span>
            <p className="note">Solo — melder spiller alene mod de tre andre.</p>
          </div>
        ) : (
          <div className="field">
            <span className="field-label">Makker</span>
            <div className="segmented" role="group">
              <button
                type="button"
                className={`btn seg ${partnerMode === 'partner' ? 'seg-active' : ''}`}
                onClick={() => setPartnerMode('partner')}
              >
                Makker
              </button>
              <button
                type="button"
                className={`btn seg ${partnerMode === 'self' ? 'seg-active' : ''}`}
                onClick={() => setPartnerMode('self')}
                data-testid="self-partner"
              >
                Selvmakker
              </button>
            </div>
            {partnerMode === 'partner' && (
              <select
                className="input mt"
                value={safePartner}
                onChange={(e) => setPartner(e.target.value)}
                data-testid="partner-select"
              >
                {PLAYERS.filter((p) => p !== declarer).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            )}
          </div>
        )}

        <div className="field">
          <Stepper
            label={isSolo ? 'Stik til melder' : 'Stik til melder/makker-parret'}
            value={tricks}
            min={0}
            max={13}
            onChange={setTricks}
            testId="tricks"
          />
        </div>

        <ScorePreview calc={calc} delta={effectiveDelta} manualOverride={manualOverride} />

        <div className="field override">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={manualOverride}
              onChange={(e) => toggleOverride(e.target.checked)}
              data-testid="override-toggle"
            />
            <span>Ret score manuelt</span>
          </label>

          {manualOverride && (
            <div className="override-grid" data-testid="override-grid">
              {PLAYERS.map((p) => (
                <div key={p} className="override-cell">
                  <label className="field-label">{p}</label>
                  <input
                    className="input"
                    type="number"
                    step="1"
                    value={overrideDelta[p]}
                    onChange={(e) => setOverrideFor(p, e.target.value)}
                    data-testid={`override-${p}`}
                  />
                </div>
              ))}
              <div className="override-sum">
                <button type="button" className="btn btn-secondary" onClick={() => setOverrideDelta({ ...calc.delta })}>
                  Nulstil til beregnet
                </button>
                <span className={overrideValid ? 'ok' : 'bad'} data-testid="override-sum">
                  Sum: {overrideSum}
                </span>
              </div>
              {!overrideValid && (
                <p className="error" data-testid="override-error">
                  Manuel score skal gå op i nul (summen er {overrideSum}).
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="action-bar">
        <button className="btn btn-secondary" onClick={onDone} data-testid="cancel-hand">
          Annuller
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={!canSave}
          data-testid="save-hand"
        >
          Gem spil
        </button>
      </div>
    </div>
  );
}

function zeroDelta() {
  const d = {};
  for (const p of PLAYERS) d[p] = 0;
  return d;
}
