// Pure operations on the single cloud history document (history/main).
// NO Firebase imports: each op takes the current doc data and returns the patch
// to write (or throws). historyStore.js runs them inside a Firestore transaction,
// so concurrent writers can never overwrite each other's hands.
//
// Doc shape (same as the old shared-game doc): { roomCode:'main', sessionName,
// players, hands[], archivedSessions[], scoringVersion, appVersion, ... }.

import { buildArchivePayload, removeArchivedSession, hasFixedPlayers } from './sharedGameUtils.js';

export const HISTORY_COLLECTION = 'history';
export const HISTORY_DOC_ID = 'main';
export const EXPORT_FORMAT = 'jungs-jydewhist-history';

function handsOf(data) {
  return Array.isArray(data && data.hands) ? data.hands : [];
}

export function addHandPatch(data, hand) {
  if (!hand || typeof hand !== 'object' || !hand.id) throw new Error('Ugyldigt spil.');
  if (handsOf(data).some((h) => h.id === hand.id)) return null; // idempotent retry
  return { hands: [...handsOf(data), hand] };
}

export function undoPatch(data) {
  return { hands: handsOf(data).slice(0, -1) };
}

export function clearPatch() {
  return { hands: [] };
}

export function deleteHandPatch(data, handId) {
  return { hands: handsOf(data).filter((h) => h.id !== handId) };
}

export function archivePatch(data) {
  const payload = buildArchivePayload(data);
  if (!payload) throw new Error('Ingen spil at arkivere.');
  return payload;
}

export function deleteArchivedPatch(data, archiveId) {
  return removeArchivedSession(data, archiveId);
}

/** Minimal shape check for a history document (used by import + seed). */
export function validateHistoryDoc(doc) {
  const problems = [];
  if (!doc || typeof doc !== 'object') return ['Ikke et gyldigt dokument.'];
  if (!hasFixedPlayers(doc.players)) problems.push('Spillere er ikke de fire faste.');
  if (!Array.isArray(doc.hands)) problems.push('hands mangler.');
  if (!Array.isArray(doc.archivedSessions)) problems.push('archivedSessions mangler.');
  return problems;
}

const DROP_ON_EXPORT = ['createdAt', 'updatedAt'];

/** JSON text for "Eksportér historik". Server timestamps are dropped. */
export function buildExport(data, now = new Date()) {
  const doc = {};
  for (const [k, v] of Object.entries(data || {})) if (!DROP_ON_EXPORT.includes(k)) doc[k] = v;
  return JSON.stringify({ format: EXPORT_FORMAT, version: 1, exportedAt: now.toISOString(), doc }, null, 2);
}

/** Parse an export file (or a raw doc). Returns { ok, doc } | { ok:false, error }. */
export function parseExport(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Filen er ikke gyldig JSON.' };
  }
  const doc = parsed && parsed.format === EXPORT_FORMAT ? parsed.doc : parsed;
  const problems = validateHistoryDoc(doc);
  if (problems.length) return { ok: false, error: problems.join(' ') };
  return { ok: true, doc };
}
