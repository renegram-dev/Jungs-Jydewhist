import React from 'react';
import Modal from './Modal.jsx';
import { biddingRows, baseExamples, vipExamples } from '../state/rules.js';

// Read-only scoring overview ("Scoringsregler"). Mobile-friendly so players can
// check the rules at the table. Numbers are derived from the scoring engine.
export default function ScoringRules({ onClose }) {
  return (
    <Modal title="Scoringsregler" onClose={onClose} testId="scoring-rules">
      <div className="rules" data-testid="rules-content">
        <section className="rules-section">
          <h3>Sådan virker det</h3>
          <ul>
            <li>4 faste spillere: René, Thomas, Carsten, Tom.</li>
            <li>Scoren går <strong>altid op i nul</strong> (zero-sum).</li>
            <li>Almindelige meldinger spilles af melder + makker — medmindre <em>selvmakker</em>.</li>
            <li><strong>Sol</strong> og <strong>Ren sol</strong> spilles alene mod de tre andre.</li>
            <li>Overstik er billige (+1 pr. stik). Understik er dyre (+5 pr. stik).</li>
            <li>Højere meldinger er med vilje mere attraktive end lave meldinger med mange overstik.</li>
          </ul>
        </section>

        <section className="rules-section">
          <h3>Meldingsrækkefølge</h3>
          <table className="rules-table">
            <thead>
              <tr><th>Melding</th><th>Rang</th><th>Grundpoint</th></tr>
            </thead>
            <tbody>
              {biddingRows().map((r) => (
                <tr key={r.id} className={r.isVip ? 'vip-row' : ''}>
                  <td>{r.label}</td>
                  <td>{r.id}</td>
                  <td>
                    {r.isVip
                      ? `Afhænger af VIP-kort: ${r.plainBasePoints} / ${r.plainBasePoints * 2} / ${r.plainBasePoints * 3} (1./2./3. kort)`
                      : r.basePoints}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rules-section">
          <h3>Grundpoint</h3>
          <p className="rules-formula">basePoints = 10 + 7 × rang</p>
          <p>For alle ikke-VIP meldinger. Eksempler:</p>
          <ul className="rules-examples">
            {baseExamples().map(([label, base]) => (
              <li key={label}>{label} = {base}</li>
            ))}
          </ul>
        </section>

        <section className="rules-section">
          <h3>VIP-scoring</h3>
          <p className="rules-formula">VIP base = grundpoint for den tilsvarende almindelige melding × VIP-position</p>
          <ul>
            <li>1. kort / første = ×1</li>
            <li>2. kort / anden = ×2</li>
            <li>3. kort / tredje = ×3</li>
          </ul>
          <p>Eksempler:</p>
          <ul className="rules-examples">
            {vipExamples().map(([label, base, pos, total]) => (
              <li key={label}>{label} = {base} × {pos} = {total}</li>
            ))}
          </ul>
        </section>

        <section className="rules-section">
          <h3>Almindelige meldinger</h3>
          <ul>
            <li>Vundet hvis melder-siden får mindst meldingens antal stik.</li>
            <li>overstik = faktiske stik − krævede stik.</li>
            <li>understik = krævede stik − faktiske stik.</li>
          </ul>
          <p className="rules-formula">Vundet: handPoints = basePoints + overtricks × 1</p>
          <p className="rules-formula">Fejlet: handPoints = basePoints + undertricks × 5</p>
          <p><strong>Makker:</strong> vundet → melder og makker hver +handPoints, hver modstander −handPoints. Fejlet → omvendt.</p>
          <p><strong>Selvmakker:</strong> vundet → melder +3 × handPoints, hver modstander −handPoints. Fejlet → omvendt.</p>
        </section>

        <section className="rules-section">
          <h3>Sol</h3>
          <ul>
            <li>Slår 9, men slås af 9 halve.</li>
            <li>Melder spiller alene mod de tre andre.</li>
            <li>Vundet hvis melder får 0 eller 1 stik: 1 stik → 73, 0 stik → 74.</li>
            <li>Fejlet hvis melder får 2+ stik: handPoints = 73 + (stik − 1) × 5.</li>
            <li>Vundet → melder +3 × handPoints, hver modstander −handPoints. Fejlet → omvendt.</li>
          </ul>
        </section>

        <section className="rules-section">
          <h3>Ren sol</h3>
          <ul>
            <li>Slår 10, men slås af 10 halve.</li>
            <li>Melder spiller alene mod de tre andre.</li>
            <li>Vundet hvis melder får 0 stik: handPoints = 108.</li>
            <li>Fejlet hvis melder får 1+ stik: handPoints = 108 + stik × 5.</li>
            <li>Vundet → melder +3 × handPoints, hver modstander −handPoints. Fejlet → omvendt.</li>
          </ul>
        </section>

        <section className="rules-section">
          <h3>Manuel score</h3>
          <ul>
            <li>Manuel score er tilladt ved særlige situationer eller bordafgørelser.</li>
            <li>Den skal <strong>altid gå op i nul</strong>.</li>
            <li>Manuelle hænder markeres i historikken med "(manuel)".</li>
          </ul>
        </section>
      </div>

      <div className="modal-actions">
        <button className="btn btn-primary" onClick={onClose} data-testid="rules-close">Luk</button>
      </div>
    </Modal>
  );
}
