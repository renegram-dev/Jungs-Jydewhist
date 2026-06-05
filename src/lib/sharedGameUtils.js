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

export function totalsFromHands(hands, players = PLAYERS) {
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
  const totals = totalsFromHands(list);
  return {
    id: newArchiveId(),
    name: name || 'Aften',
    startedAt: list.length && list[0].timestamp ? list[0].timestamp : now.toISOString(),
    archivedAt: now.toISOString(),
    hands: list.map((h) => ({ ...h })),
    totals,
    medals: computeMedalsForTotals(totals), // permanent medals for this evening
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

/**
 * The Firestore write payload for "Arkivér aften og start ny": appends the current
 * hands (with frozen totals) to archivedSessions and clears the active hands.
 * Returns null when there is nothing to archive. This is what gets written to the
 * shared document (not just React state).
 */
export function buildArchivePayload(data) {
  const hands = Array.isArray(data?.hands) ? data.hands : [];
  if (hands.length === 0) return null;
  const entry = buildArchiveEntry({ name: data?.sessionName, hands });
  return { archivedSessions: [...getArchivedSessions(data), entry], hands: [] };
}

/**
 * The Firestore write payload for deleting one archived evening by id. Removes only
 * that entry; current hands and other archived sessions are untouched.
 */
export function removeArchivedSession(data, archiveId) {
  return { archivedSessions: getArchivedSessions(data).filter((a) => a.id !== archiveId) };
}

// --- Medals (per-evening medals + long-term medal-point standings) ---

export const MEDALS = Object.freeze({
  gold: { key: 'gold', emoji: '🥇', label: 'Guld', points: 3 },
  silver: { key: 'silver', emoji: '🥈', label: 'Sølv', points: 2 },
  bronze: { key: 'bronze', emoji: '🥉', label: 'Bronze', points: 1 },
  poop: { key: 'poop', emoji: '💩', label: 'Lort!', points: 0 },
});
const MEDAL_KEYS = ['gold', 'silver', 'bronze', 'poop'];

/** Medal for a (1-based) competition rank: 1=gold, 2=silver, 3=bronze, 4=poop. */
export function medalForRank(rank) {
  return MEDAL_KEYS[rank - 1] || 'poop';
}

/**
 * Rank players by score, highest first, using standard COMPETITION ranking:
 * equal scores share a rank and the next rank(s) are skipped (1,1,3,4 / 1,2,2,4 …).
 * Returns [{ player, score, rank }] in score order.
 */
export function rankPlayersByScore(totals, players = PLAYERS) {
  const ordered = [...players].sort((a, b) => (totals[b] ?? 0) - (totals[a] ?? 0));
  const out = [];
  let prevScore = null;
  let prevRank = 0;
  ordered.forEach((player, i) => {
    const score = totals[player] ?? 0;
    const rank = prevScore !== null && score === prevScore ? prevRank : i + 1;
    out.push({ player, score, rank });
    prevScore = score;
    prevRank = rank;
  });
  return out;
}

/** { player: 'gold'|'silver'|'bronze'|'poop' } for one evening's totals. */
export function computeMedalsForTotals(totals, players = PLAYERS) {
  const medals = {};
  for (const { player, rank } of rankPlayersByScore(totals || {}, players)) {
    medals[player] = medalForRank(rank);
  }
  return medals;
}

/** Medals for an archived session: use stored medals if valid, else derive from totals. */
export function medalsForArchived(session, players = PLAYERS) {
  const stored = session && session.medals;
  if (stored && typeof stored === 'object' && players.every((p) => MEDAL_KEYS.includes(stored[p]))) {
    return stored;
  }
  return computeMedalsForTotals(session && session.totals ? session.totals : {}, players);
}

/** { player: { gold, silver, bronze, poop } } across all archived evenings. */
export function aggregateMedalCounts(archivedSessions, players = PLAYERS) {
  const list = Array.isArray(archivedSessions) ? archivedSessions : [];
  const counts = {};
  for (const p of players) counts[p] = { gold: 0, silver: 0, bronze: 0, poop: 0 };
  for (const session of list) {
    const medals = medalsForArchived(session, players);
    for (const p of players) {
      const m = medals[p];
      if (m && counts[p][m] !== undefined) counts[p][m] += 1;
    }
  }
  return counts;
}

/** medalPoints = gold*3 + silver*2 + bronze*1 + poop*0 for one player's counts. */
export function computeMedalPoints(counts) {
  if (!counts) return 0;
  return (counts.gold || 0) * 3 + (counts.silver || 0) * 2 + (counts.bronze || 0) * 1;
}

/**
 * Long-term medal standings. Sorted PRIMARILY by medalPoints (not cumulative
 * score). Each row: { player, counts, medalPoints, cumulativeScore, provisional }.
 * provisional is the current (un-archived) evening's medal, or null when no active
 * hands — it does NOT count toward counts/medalPoints.
 */
export function buildMedalStandings(archivedSessions, currentHands, players = PLAYERS) {
  const list = Array.isArray(archivedSessions) ? archivedSessions : [];
  const counts = aggregateMedalCounts(list, players);

  const cumulative = {};
  for (const p of players) cumulative[p] = 0;
  for (const s of list) for (const p of players) cumulative[p] += s.totals?.[p] ?? 0;
  const currentTotals = totalsFromHands(currentHands, players);
  for (const p of players) cumulative[p] += currentTotals[p];

  const hasActive = Array.isArray(currentHands) && currentHands.length > 0;
  const provisional = hasActive ? computeMedalsForTotals(currentTotals, players) : null;

  return players
    .map((player, order) => ({
      player,
      counts: counts[player],
      medalPoints: computeMedalPoints(counts[player]),
      cumulativeScore: cumulative[player],
      provisional: provisional ? provisional[player] : null,
      order,
    }))
    .sort(
      (a, b) =>
        b.medalPoints - a.medalPoints ||
        b.counts.gold - a.counts.gold ||
        b.counts.silver - a.counts.silver ||
        b.counts.bronze - a.counts.bronze ||
        b.cumulativeScore - a.cumulativeScore ||
        a.order - b.order,
    );
}
