// Plain-text score report for the "Kopiér score" button — scoreboard standings
// plus compact, chronological hand history.

import { summarizeHand } from '../lib/scoring.js';
import { computeTotals, sortedByScore, handsWithDisplayNumbers } from './selectors.js';

function signed(v) {
  return v > 0 ? `+${v}` : `${v}`;
}

export function buildScoreText(session) {
  const totals = computeTotals(session.hands);
  const order = sortedByScore(totals);
  const lines = [];
  lines.push(`Jungs-Jydewhist — ${session.name}`);
  lines.push('');
  lines.push('Stilling:');
  for (const p of order) lines.push(`  ${p}: ${signed(totals[p])}`);
  lines.push(`Spil i alt: ${session.hands.length}`);
  if (session.hands.length) {
    lines.push('');
    lines.push('Historik:');
    for (const { hand, displayNumber } of handsWithDisplayNumbers(session.hands)) {
      lines.push(summarizeHand(hand, displayNumber));
    }
  }
  return lines.join('\n');
}
