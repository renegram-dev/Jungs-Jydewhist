// Pure helpers for shared ("Delt spil") mode. NO Firebase imports here, so these
// can be unit-tested and used in the UI without pulling in the Firebase SDK.

import { PLAYERS } from './scoring.js';

// Room-code alphabet without easily-confused characters (no I, O, 0, 1).
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Short, hard-to-guess room code, e.g. "K7Q2MP". */
export function generateRoomCode(length = 6) {
  let code = '';
  const c = typeof crypto !== 'undefined' && crypto.getRandomValues ? crypto : null;
  for (let i = 0; i < length; i++) {
    let idx;
    if (c) {
      const a = new Uint32Array(1);
      c.getRandomValues(a);
      idx = a[0] % ROOM_ALPHABET.length;
    } else {
      idx = Math.floor(Math.random() * ROOM_ALPHABET.length);
    }
    code += ROOM_ALPHABET[idx];
  }
  return code;
}

/** Uppercase, strip non-alphanumerics, cap length — for user-typed codes. */
export function normalizeRoomCode(input) {
  return String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}

export function isValidRoomCode(input) {
  return /^[A-Z0-9]{4,12}$/.test(normalizeRoomCode(input));
}

/** Build a join link that preserves the current origin + base path. */
export function buildShareLink(roomCode, baseUrl) {
  const base =
    baseUrl ||
    (typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '');
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}room=${encodeURIComponent(roomCode)}`;
}

/** True if players are exactly the fixed four (order-independent). */
export function hasFixedPlayers(players) {
  return (
    Array.isArray(players) &&
    players.length === PLAYERS.length &&
    PLAYERS.every((p) => players.includes(p))
  );
}

/** Minimal shape validation for a shared-game document read from Firestore. */
export function isValidSharedDoc(data) {
  return Boolean(
    data &&
      typeof data === 'object' &&
      typeof data.roomCode === 'string' &&
      typeof data.hostUid === 'string' &&
      hasFixedPlayers(data.players) &&
      Array.isArray(data.hands),
  );
}

/** Map a Firestore shared-game doc into the local "session" shape the UI uses. */
export function mapSharedDocToSession(data) {
  if (!data) return null;
  return {
    id: data.roomCode,
    name: data.sessionName || 'Delt spil',
    players: Array.isArray(data.players) ? data.players : [...PLAYERS],
    hands: Array.isArray(data.hands) ? data.hands : [],
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
    shared: true,
  };
}

// --- Long-term archive / cumulative scoring (shared mode) ---

function totalsFromHands(hands, players = PLAYERS) {
  const t = {};
  for (const p of players) t[p] = 0;
  for (const h of hands || []) {
    for (const p of players) t[p] += h.delta?.[p] ?? 0;
  }
  return t;
}

function newArchiveId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `arch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Missing archivedSessions is treated as [] (migration-safe). */
export function getArchivedSessions(data) {
  return Array.isArray(data?.archivedSessions) ? data.archivedSessions : [];
}

/**
 * Build an archived-session entry (one "evening") from the shared game's current
 * name + hands. Totals are computed and frozen into the entry.
 */
export function buildArchiveEntry({ name, hands } = {}, now = new Date()) {
  const list = Array.isArray(hands) ? hands : [];
  return {
    id: newArchiveId(),
    name: name || 'Aften',
    startedAt: list.length && list[0].timestamp ? list[0].timestamp : now.toISOString(),
    archivedAt: now.toISOString(),
    hands: list.map((h) => ({ ...h })),
    totals: totalsFromHands(list),
    handCount: list.length,
  };
}

/**
 * Lifetime totals = sum of every archived session's stored totals + the totals of
 * the current (not-yet-archived) hands. Always zero-sum when inputs are.
 */
export function cumulativeTotals(data, players = PLAYERS) {
  const t = {};
  for (const p of players) t[p] = 0;
  for (const a of getArchivedSessions(data)) {
    for (const p of players) t[p] += a.totals?.[p] ?? 0;
  }
  const current = totalsFromHands(data?.hands, players);
  for (const p of players) t[p] += current[p];
  return t;
}
