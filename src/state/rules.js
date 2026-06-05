// Data for the in-app "Scoringsregler" overview, derived from the scoring engine
// so the displayed numbers can never drift from the actual calculation.

import { getContractList } from '../lib/scoring.js';

function byLabel(label) {
  return getContractList().find((c) => c.label === label);
}

/** One row per contract for the bidding-order table. */
export function biddingRows() {
  return getContractList().map((c) => ({
    id: c.id,
    label: c.label,
    isVip: c.type === 'vip',
    isSolo: c.isSolo,
    basePoints: c.basePoints,
    plainBasePoints: c.plainBasePoints, // multiplier base for VIP
  }));
}

/** [label, basePoints] examples for the non-VIP base-point formula. */
export function baseExamples() {
  return ['7', '7 halve', '7 gode', '8', '9', 'Sol', '10', 'Ren sol'].map((l) => [
    l,
    byLabel(l).basePoints,
  ]);
}

/** [label, plainBase, position, vipBase] examples for VIP scoring. */
export function vipExamples() {
  const seven = byLabel('7').basePoints; // 10
  const eight = byLabel('8').basePoints; // 38
  const rows = [];
  for (const [name, base] of [['7', seven], ['8', eight]]) {
    for (const pos of [1, 2, 3]) {
      rows.push([`${name} VIP i ${['første', 'anden', 'tredje'][pos - 1]}`, base, pos, base * pos]);
    }
  }
  return rows;
}
