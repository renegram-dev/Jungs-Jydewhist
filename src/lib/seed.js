// Pure builder + validator for the one-time historical migration: the two real
// evenings (June 5 / room 63U82R, August 16 / room WVACWK) become two
// archivedSessions of history/main. Hands are copied VERBATIM — never re-scored
// (older hands may predate scoring v2). Any inconsistency throws; nothing is
// auto-corrected. Used by scripts/history-tools.mjs and unit tests.

import { PLAYERS } from './scoring.js';
import { totalsFromHands, computeMedalsForTotals, hasFixedPlayers } from './sharedGameUtils.js';

export const EXPECTED_ROOMS = Object.freeze({ '63U82R': 13, WVACWK: 7 });
export const SEED_SCORING_VERSION = 2;

const clone = (x) => JSON.parse(JSON.stringify(x));

/** Stable JSON (sorted keys) so hashes are independent of key order. */
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function sameMap(a, b) {
  return PLAYERS.every((p) => (a?.[p] ?? 0) === (b?.[p] ?? 0));
}

function sameMedals(a, b) {
  return PLAYERS.every((p) => a?.[p] === b?.[p]);
}

/** Problems for one hand ([] when fine). */
export function checkHand(h) {
  const out = [];
  if (!h || typeof h !== 'object') return ['hand is not an object'];
  if (!h.id) out.push('hand without id');
  if (!h.timestamp) out.push(`hand ${h.id}: no timestamp`);
  let sum = 0;
  for (const p of PLAYERS) {
    const v = h.delta?.[p];
    if (!Number.isInteger(v)) out.push(`hand ${h.id}: delta.${p} is not an integer`);
    else sum += v;
  }
  if (sum !== 0) out.push(`hand ${h.id}: delta sums to ${sum}, not 0`);
  return out;
}

function checkEvening(entry, label) {
  const problems = [];
  const hands = Array.isArray(entry.hands) ? entry.hands : [];
  hands.forEach((h) => checkHand(h).forEach((m) => problems.push(`${label}: ${m}`)));
  const totals = totalsFromHands(hands);
  if (PLAYERS.reduce((a, p) => a + totals[p], 0) !== 0) problems.push(`${label}: evening is not zero-sum`);
  if (entry.totals && !sameMap(entry.totals, totals)) problems.push(`${label}: stored totals differ from hands`);
  const medals = computeMedalsForTotals(totals);
  if (entry.medals && !sameMedals(entry.medals, medals)) problems.push(`${label}: stored medals differ from totals`);
  if (entry.handCount != null && entry.handCount !== hands.length) problems.push(`${label}: handCount mismatch`);
  return problems;
}

/** Evenings contained in one legacy room doc: its archives (verbatim) + active hands. */
export function eveningsFromRoom(code, room) {
  const evenings = [];
  const archived = Array.isArray(room?.archivedSessions) ? room.archivedSessions : [];
  for (const a of archived) evenings.push(clone(a));
  const active = Array.isArray(room?.hands) ? room.hands : [];
  if (active.length) {
    const hands = clone(active);
    evenings.push({
      id: `legacy-${code}`,
      name: room.sessionName || 'Aften',
      startedAt: hands[0].timestamp,
      archivedAt: hands[hands.length - 1].timestamp,
      hands,
    });
  }
  return evenings;
}

/**
 * rooms: { '63U82R': roomDoc, WVACWK: roomDoc }.
 * Returns { doc, report }; throws Error(problems joined) on ANY inconsistency.
 */
export function buildSeed(rooms, expected = EXPECTED_ROOMS) {
  const problems = [];
  const archived = [];
  const report = [];
  const seenIds = new Set();

  for (const [code, want] of Object.entries(expected)) {
    const room = rooms?.[code];
    if (!room) {
      problems.push(`room ${code}: not found in backup`);
      continue;
    }
    if (room.roomCode && room.roomCode !== code) problems.push(`room ${code}: doc says roomCode ${room.roomCode}`);
    const evenings = eveningsFromRoom(code, room);
    const total = evenings.reduce((n, e) => n + (e.hands ? e.hands.length : 0), 0);
    if (total !== want) problems.push(`room ${code}: ${total} hands, expected ${want}`);
    for (const e of evenings) {
      const label = `room ${code} / ${e.name || e.id}`;
      problems.push(...checkEvening(e, label));
      for (const h of e.hands || []) {
        if (seenIds.has(h.id)) problems.push(`${label}: duplicate hand id ${h.id}`);
        seenIds.add(h.id);
      }
      const totals = totalsFromHands(e.hands || []);
      const entry = {
        ...e,
        totals: e.totals || totals,
        medals: e.medals || computeMedalsForTotals(totals),
        handCount: (e.hands || []).length,
        migratedFromRoom: code,
      };
      archived.push(entry);
      report.push({ room: code, id: entry.id, name: entry.name, hands: entry.handCount });
    }
  }

  const totalHands = archived.reduce((n, e) => n + e.hands.length, 0);
  const wantTotal = Object.values(expected).reduce((a, b) => a + b, 0);
  if (totalHands !== wantTotal) problems.push(`total ${totalHands} hands, expected ${wantTotal}`);
  if (problems.length) throw new Error(`Seed validation failed:\n- ${problems.join('\n- ')}`);

  archived.sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)));
  const doc = {
    roomCode: 'main',
    sessionName: 'Aften',
    players: [...PLAYERS],
    hands: [],
    archivedSessions: archived,
    scoringVersion: SEED_SCORING_VERSION,
    schemaVersion: 1,
  };
  return { doc, report };
}

/**
 * Compare a live export doc against a seed doc: every seeded evening must exist
 * unchanged (hands hash, totals, medals, ids, timestamps). Extra evenings in the
 * live doc are fine. Returns { ok, problems }.
 */
export function verifyAgainstSeed(liveDoc, seedDoc) {
  const problems = [];
  if (!liveDoc || !hasFixedPlayers(liveDoc.players)) problems.push('live doc: players invalid');
  const live = new Map((liveDoc?.archivedSessions || []).map((a) => [a.id, a]));
  for (const s of seedDoc.archivedSessions) {
    const l = live.get(s.id);
    if (!l) {
      problems.push(`missing evening ${s.id}`);
      continue;
    }
    if (canonicalJson(l.hands) !== canonicalJson(s.hands)) problems.push(`${s.id}: hands differ`);
    if (!sameMap(l.totals, s.totals)) problems.push(`${s.id}: totals differ`);
    if (!sameMedals(l.medals, s.medals)) problems.push(`${s.id}: medals differ`);
    checkEvening(l, s.id).forEach((m) => problems.push(m));
  }
  return { ok: problems.length === 0, problems };
}
