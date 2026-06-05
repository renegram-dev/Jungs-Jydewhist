// Pure scoring engine for Jungs-Jydewhist (René's house-rule whist variant).
//
// CORRECTNESS IS THE HIGHEST PRIORITY. This module is intentionally free of any
// DOM, React, or localStorage access so it can be exhaustively unit-tested.
// The authoritative behaviour is pinned by src/test/scoring.test.js — if you
// ever change a rule, update the tests FIRST.
//
// Do NOT implement generic Whist scoring and do NOT add contracts beyond the 30
// listed below.

/** The four fixed players, in seating order. This is an MVP constant. */
export const PLAYERS = Object.freeze(['René', 'Thomas', 'Carsten', 'Tom']);

// Contract labels in EXACT bidding order. The array index IS the contract id
// and the contract rank. basePoints = 10 + 7 * rank for every contract.
const CONTRACT_LABELS = [
  '7', '7 halve', '7 gode', '7 VIP', // 0..3
  '8', '8 halve', '8 gode', '8 VIP', // 4..7
  '9', 'Sol', '9 halve', '9 gode', '9 VIP', // 8..12  (Sol beats 9, beaten by 9 halve)
  '10', 'Ren sol', '10 halve', '10 gode', '10 VIP', // 13..17 (Ren sol beats 10, beaten by 10 halve)
  '11', '11 halve', '11 gode', '11 VIP', // 18..21
  '12', '12 halve', '12 gode', '12 VIP', // 22..25
  '13', '13 halve', '13 gode', '13 VIP', // 26..29
];

function deriveType(label) {
  if (label === 'Ren sol') return 'rensol';
  if (label === 'Sol') return 'sol';
  if (label.endsWith('halve')) return 'halve';
  if (label.endsWith('gode')) return 'gode';
  if (label.endsWith('VIP')) return 'vip';
  return 'plain';
}

const CONTRACTS = Object.freeze(
  CONTRACT_LABELS.map((label, id) => {
    const type = deriveType(label);
    const isSolo = type === 'sol' || type === 'rensol';
    // For non-solo contracts the required tricks is the leading integer in the
    // label ("9 gode" -> 9, "10 VIP" -> 10). Solo contracts have no trick target.
    const requiredTricks = isSolo ? null : parseInt(label, 10);
    return Object.freeze({
      id,
      label,
      type, // 'plain' | 'halve' | 'gode' | 'vip' | 'sol' | 'rensol'
      isSolo,
      requiredTricks,
      basePoints: 10 + 7 * id,
    });
  }),
);

/** All 30 contracts, frozen, ordered so index === id === rank. */
export function getContractList() {
  return CONTRACTS;
}

/** Single contract by id, or undefined. */
export function getContract(id) {
  return CONTRACTS[id];
}

const MIN_TRICKS = 0;
const MAX_TRICKS = 13;

/** True when n is an integer in [0, 13]. */
export function isValidTricks(n) {
  return Number.isInteger(n) && n >= MIN_TRICKS && n <= MAX_TRICKS;
}

// Distribute handPoints across the four players. Always zero-sum.
//   partner: declarer & partner each ±hp; the two opponents each ∓hp.
//   self/solo: declarer alone ±3·hp; each of the other three ∓hp.
function buildDelta({ players, declarer, partner, mode, handPoints, success }) {
  const sign = success ? 1 : -1;
  const hp = handPoints;
  const delta = {};
  for (const p of players) delta[p] = 0;

  if (mode === 'partner') {
    delta[declarer] += sign * hp;
    delta[partner] += sign * hp;
    for (const p of players) {
      if (p !== declarer && p !== partner) delta[p] -= sign * hp;
    }
  } else {
    // 'self' (Selvmakker) and 'solo' (Sol / Ren sol): one against three.
    delta[declarer] += sign * 3 * hp;
    for (const p of players) {
      if (p !== declarer) delta[p] -= sign * hp;
    }
  }
  return delta;
}

/**
 * Compute the full scoring result for one hand.
 *
 * input = {
 *   contractId,            // 0..29
 *   declarer,              // player name
 *   partnerMode,           // 'partner' | 'self' | 'solo' (forced to 'solo' for Sol/Ren sol)
 *   partner,               // player name when partnerMode === 'partner', else null
 *   tricks,                // integer 0..13 (declarer-side tricks, or declarer tricks for solo)
 *   players,               // optional array of 4 names; defaults to PLAYERS
 * }
 *
 * Returns { contractId, contractLabel, success, requiredTricks, actualTricks,
 *           basePoints, overtricks, undertricks, handPoints, delta, explanation }.
 */
export function calculateHandScore(input) {
  const {
    contractId,
    declarer,
    partnerMode,
    partner,
    tricks,
    players = PLAYERS,
  } = input;

  const contract = CONTRACTS[contractId];
  if (!contract) throw new Error(`Unknown contractId: ${contractId}`);

  const base = contract.basePoints;
  let success;
  let handPoints;
  let requiredTricks = contract.requiredTricks;
  let overtricks = 0;
  let undertricks = 0;
  let explanation;

  if (contract.type === 'sol') {
    // Declarer alone, may take at most 1 trick.
    success = tricks <= 1;
    if (success) {
      handPoints = tricks === 0 ? base + 1 : base; // 0 stik -> 74, 1 stik -> 73
      explanation = `Sol (højst 1 stik): fik ${tricks} → Vundet, ${handPoints} point.`;
    } else {
      handPoints = base + (tricks - 1) * 5;
      explanation = `Sol (højst 1 stik): fik ${tricks} → Tabt, ${tricks - 1} for mange à 5 → ${handPoints} point.`;
    }
  } else if (contract.type === 'rensol') {
    // Declarer alone, must take 0 tricks.
    success = tricks === 0;
    if (success) {
      handPoints = base; // 108
      explanation = `Ren sol (0 stik): fik 0 → Vundet, ${handPoints} point.`;
    } else {
      handPoints = base + tricks * 5;
      explanation = `Ren sol (0 stik): fik ${tricks} → Tabt, ${tricks} à 5 → ${handPoints} point.`;
    }
  } else {
    // Ordinary number contract (plain / halve / gode / vip): same trick target.
    success = tricks >= requiredTricks;
    if (success) {
      overtricks = tricks - requiredTricks;
      handPoints = base + overtricks * 1;
      explanation =
        `${contract.label} kræver ${requiredTricks} stik, fik ${tricks} → Vundet` +
        (overtricks ? `, +${overtricks} overstik (à 1)` : '') +
        `, ${handPoints} point.`;
    } else {
      undertricks = requiredTricks - tricks;
      handPoints = base + undertricks * 5;
      explanation =
        `${contract.label} kræver ${requiredTricks} stik, fik ${tricks} → Tabt, ` +
        `${undertricks} understik à 5 → ${handPoints} point.`;
    }
  }

  // Sol / Ren sol are always solo regardless of the supplied partnerMode.
  const mode = contract.isSolo ? 'solo' : partnerMode;
  const delta = buildDelta({ players, declarer, partner, mode, handPoints, success });

  return {
    contractId,
    contractLabel: contract.label,
    success,
    requiredTricks: contract.isSolo ? null : requiredTricks,
    actualTricks: tricks,
    basePoints: base,
    overtricks,
    undertricks,
    handPoints,
    delta,
    explanation,
  };
}

/**
 * A score delta is valid iff it has exactly the four player keys and the integer
 * values sum to zero. Used both for computed deltas and for manual overrides.
 */
export function validateScoreDelta(delta, players = PLAYERS) {
  if (!delta || typeof delta !== 'object') return false;
  const keys = Object.keys(delta);
  if (keys.length !== players.length) return false;
  let sum = 0;
  for (const p of players) {
    const v = delta[p];
    if (!Number.isInteger(v)) return false;
    sum += v;
  }
  return sum === 0;
}

function formatSigned(v) {
  return v > 0 ? `+${v}` : `${v}`;
}

/**
 * Compact one-line summary of a saved hand.
 *
 * displayNumber is the recomputed, DISPLAY-ONLY position (1-based) in the
 * current chronological hand list. It is derived, not a stored audit number.
 *
 * e.g. "#3 René + Tom — 9 gode — 10 stik — Vundet — René +68, Tom +68, Thomas -68, Carsten -68"
 */
export function summarizeHand(hand, displayNumber, players = PLAYERS) {
  const n = displayNumber ?? hand.handNumber ?? '?';
  const contract = CONTRACTS[hand.contractId];
  const label = hand.contractLabel || (contract ? contract.label : `#${hand.contractId}`);

  let who;
  if (hand.partnerMode === 'partner' && hand.partner) {
    who = `${hand.declarer} + ${hand.partner}`;
  } else if (hand.partnerMode === 'self') {
    who = `${hand.declarer} (Selvmakker)`;
  } else {
    who = `${hand.declarer}`; // solo — the contract label already says Sol / Ren sol
  }

  const result = hand.success ? 'Vundet' : 'Tabt';
  const deltaStr = players.map((p) => `${p} ${formatSigned(hand.delta[p])}`).join(', ');

  return `#${n} ${who} — ${label} — ${hand.tricks} stik — ${result} — ${deltaStr}`;
}
