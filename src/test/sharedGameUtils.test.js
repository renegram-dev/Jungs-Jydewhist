import { describe, it, expect } from 'vitest';
import {
  generateRoomCode,
  normalizeRoomCode,
  isValidRoomCode,
  buildShareLink,
  hasFixedPlayers,
  isValidSharedDoc,
  mapSharedDocToSession,
  buildArchiveEntry,
  getArchivedSessions,
  cumulativeTotals,
} from '../lib/sharedGameUtils.js';
import { PLAYERS } from '../lib/scoring.js';

const [RENE, THOMAS, CARSTEN, TOM] = PLAYERS;
const delta = (a, b, c, d) => ({ [RENE]: a, [THOMAS]: b, [CARSTEN]: c, [TOM]: d });
const zeroSum = (t) => PLAYERS.reduce((s, p) => s + t[p], 0);

describe('room codes', () => {
  it('generates codes from the safe alphabet, default length 6', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateRoomCode();
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/); // no I, O, 0, 1
    }
  });

  it('normalizes user input', () => {
    expect(normalizeRoomCode(' k7q-2mp ')).toBe('K7Q2MP');
    expect(normalizeRoomCode('abc')).toBe('ABC');
  });

  it('validates room codes', () => {
    expect(isValidRoomCode('K7Q2MP')).toBe(true);
    expect(isValidRoomCode('k7q-2mp')).toBe(true); // normalized first
    expect(isValidRoomCode('AB')).toBe(false); // too short
    expect(isValidRoomCode('')).toBe(false);
  });
});

describe('share link', () => {
  it('appends ?room= preserving the base path', () => {
    expect(buildShareLink('K7Q2MP', 'https://renegram-dev.github.io/Jungs-Jydewhist/')).toBe(
      'https://renegram-dev.github.io/Jungs-Jydewhist/?room=K7Q2MP',
    );
  });
  it('uses & when the base already has a query', () => {
    expect(buildShareLink('AB12', 'https://x.dev/app?foo=1')).toBe('https://x.dev/app?foo=1&room=AB12');
  });
});

describe('shared doc validation + mapping', () => {
  const goodDoc = {
    roomCode: 'K7Q2MP',
    hostUid: 'uid-123',
    sessionName: 'Aftenkamp',
    players: [...PLAYERS],
    hands: [],
    scoringVersion: 2,
    appVersion: '1.0.0',
  };

  it('accepts a well-formed doc with the fixed players', () => {
    expect(hasFixedPlayers(PLAYERS)).toBe(true);
    expect(isValidSharedDoc(goodDoc)).toBe(true);
  });

  it('rejects docs with the wrong players or missing fields', () => {
    expect(isValidSharedDoc({ ...goodDoc, players: ['A', 'B', 'C', 'D'] })).toBe(false);
    expect(isValidSharedDoc({ ...goodDoc, hands: 'nope' })).toBe(false);
    expect(isValidSharedDoc({ ...goodDoc, hostUid: undefined })).toBe(false);
    expect(isValidSharedDoc(null)).toBe(false);
  });

  it('maps a shared doc into the session shape', () => {
    const s = mapSharedDocToSession(goodDoc);
    expect(s).toMatchObject({ id: 'K7Q2MP', name: 'Aftenkamp', players: PLAYERS, hands: [], shared: true });
  });

  it('maps null to null', () => {
    expect(mapSharedDocToSession(null)).toBeNull();
  });
});

describe('archive + cumulative scoring', () => {
  it('buildArchiveEntry captures totals, handCount, hands and timestamps', () => {
    const hands = [
      { id: 'a', timestamp: '2026-06-05T18:00:00.000Z', delta: delta(10, 10, -10, -10) },
      { id: 'b', timestamp: '2026-06-05T18:05:00.000Z', delta: delta(-15, -15, 15, 15) },
    ];
    const e = buildArchiveEntry({ name: 'Aften 1', hands });
    expect(e.name).toBe('Aften 1');
    expect(e.handCount).toBe(2);
    expect(e.hands).toHaveLength(2);
    expect(e.totals).toEqual(delta(-5, -5, 5, 5));
    expect(zeroSum(e.totals)).toBe(0);
    expect(e.startedAt).toBe('2026-06-05T18:00:00.000Z'); // first hand's time
    expect(typeof e.archivedAt).toBe('string');
    expect(typeof e.id).toBe('string');
  });

  it('getArchivedSessions treats missing/invalid as []', () => {
    expect(getArchivedSessions(null)).toEqual([]);
    expect(getArchivedSessions({})).toEqual([]);
    expect(getArchivedSessions({ archivedSessions: 'nope' })).toEqual([]);
    expect(getArchivedSessions({ archivedSessions: [{ id: 'x' }] })).toHaveLength(1);
  });

  it('cumulativeTotals sums two archived sessions + current hands and stays zero-sum', () => {
    const data = {
      archivedSessions: [
        { totals: delta(10, 10, -10, -10) },
        { totals: delta(-15, -15, 15, 15) },
      ],
      hands: [{ delta: delta(20, 20, -20, -20) }],
    };
    const c = cumulativeTotals(data);
    expect(c).toEqual(delta(15, 15, -15, -15));
    expect(zeroSum(c)).toBe(0);
  });

  it('cumulativeTotals handles a room with no archivedSessions (migration)', () => {
    const c = cumulativeTotals({ hands: [{ delta: delta(10, 10, -10, -10) }] });
    expect(c).toEqual(delta(10, 10, -10, -10));
  });

  it('simulated archive: current hands move into an archived entry and clear', () => {
    const before = {
      sessionName: 'Aften',
      hands: [{ id: 'a', timestamp: '2026-06-05T18:00:00.000Z', delta: delta(10, 10, -10, -10) }],
      archivedSessions: [],
    };
    const entry = buildArchiveEntry({ name: before.sessionName, hands: before.hands });
    const after = { ...before, archivedSessions: [...getArchivedSessions(before), entry], hands: [] };

    expect(after.hands).toHaveLength(0); // current cleared
    expect(after.archivedSessions).toHaveLength(1); // evening preserved
    // The score is preserved in cumulative even though current hands are gone.
    expect(cumulativeTotals(after)).toEqual(delta(10, 10, -10, -10));
  });
});
