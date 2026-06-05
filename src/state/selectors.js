// Derived values computed from saved hands. The scoreboard is ALWAYS recomputed
// from hand deltas here — totals are never stored, so they cannot drift.

import { PLAYERS } from '../lib/scoring.js';

/** Sum each player's delta across all hands. Returns { player: total }. */
export function computeTotals(hands, players = PLAYERS) {
  const totals = {};
  for (const p of players) totals[p] = 0;
  for (const h of hands || []) {
    for (const p of players) totals[p] += h.delta?.[p] ?? 0;
  }
  return totals;
}

/** A valid scoreboard must always sum to zero. */
export function totalsAreZeroSum(totals, players = PLAYERS) {
  return players.reduce((acc, p) => acc + (totals[p] ?? 0), 0) === 0;
}

/** Player names sorted highest score first (ties keep seating order). */
export function sortedByScore(totals, players = PLAYERS) {
  return [...players].sort((a, b) => (totals[b] ?? 0) - (totals[a] ?? 0));
}

/**
 * Hands paired with their DERIVED display number (1-based chronological
 * position). Pass reverse=true for newest-first history while keeping numbers
 * tied to chronological order.
 */
export function handsWithDisplayNumbers(hands, reverse = false) {
  const numbered = (hands || []).map((hand, i) => ({ hand, displayNumber: i + 1 }));
  return reverse ? numbered.slice().reverse() : numbered;
}
