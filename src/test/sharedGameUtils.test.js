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
  buildArchivePayload,
  removeArchivedSession,
  computeMedalsForTotals,
  medalsForArchived,
  aggregateMedalCounts,
  computeMedalPoints,
  buildMedalStandings,
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

  it('buildArchivePayload writes archivedSessions + cleared hands (not just UI state)', () => {
    const data = {
      sessionName: 'Aften',
      hands: [{ id: 'a', timestamp: '2026-06-05T18:00:00.000Z', delta: delta(10, 10, -10, -10) }],
      archivedSessions: [{ id: 'old', totals: delta(1, -1, 1, -1) }],
    };
    const payload = buildArchivePayload(data);
    expect(payload.hands).toEqual([]); // active cleared
    expect(payload.archivedSessions).toHaveLength(2); // existing preserved + new
    expect(payload.archivedSessions[0].id).toBe('old');
    expect(payload.archivedSessions[1].totals).toEqual(delta(10, 10, -10, -10));
  });

  it('buildArchivePayload returns null when there is nothing to archive', () => {
    expect(buildArchivePayload({ hands: [] })).toBeNull();
    expect(buildArchivePayload({})).toBeNull();
  });

  it('removeArchivedSession deletes only the chosen evening; cumulative recomputes; current hands stay; zero-sum', () => {
    const data = {
      hands: [{ delta: delta(5, 5, -5, -5) }], // current active, untouched
      archivedSessions: [
        { id: 'e1', totals: delta(10, 10, -10, -10) },
        { id: 'e2', totals: delta(-15, -15, 15, 15) },
      ],
    };
    const payload = removeArchivedSession(data, 'e1');
    expect(payload.archivedSessions.map((a) => a.id)).toEqual(['e2']);

    const after = { ...data, ...payload };
    expect(after.hands).toHaveLength(1); // current hands unchanged
    const c = cumulativeTotals(after);
    expect(c).toEqual(delta(-10, -10, 10, 10)); // e2 + current
    expect(zeroSum(c)).toBe(0);
  });
});

describe('medals — per evening (competition ranking)', () => {
  it('1) normal evening: gold/silver/bronze/poop', () => {
    expect(computeMedalsForTotals(delta(100, 50, 10, -160))).toEqual({
      [RENE]: 'gold', [THOMAS]: 'silver', [CARSTEN]: 'bronze', [TOM]: 'poop',
    });
  });

  it('2) tie for first: two gold, no silver, then bronze, poop', () => {
    expect(computeMedalsForTotals(delta(100, 100, -50, -150))).toEqual({
      [RENE]: 'gold', [THOMAS]: 'gold', [CARSTEN]: 'bronze', [TOM]: 'poop',
    });
  });

  it('3) tie for second: one gold, two silver, no bronze, poop', () => {
    expect(computeMedalsForTotals(delta(100, 50, 50, -200))).toEqual({
      [RENE]: 'gold', [THOMAS]: 'silver', [CARSTEN]: 'silver', [TOM]: 'poop',
    });
  });

  it('4) tie for third/fourth: gold, silver, two bronze, no poop', () => {
    expect(computeMedalsForTotals(delta(100, 50, -10, -10))).toEqual({
      [RENE]: 'gold', [THOMAS]: 'silver', [CARSTEN]: 'bronze', [TOM]: 'bronze',
    });
  });

  it('5) buildArchiveEntry stores the evening medal result', () => {
    const hands = [{ id: 'a', delta: delta(100, 50, 10, -160) }];
    const e = buildArchiveEntry({ name: 'Aften', hands });
    expect(e.medals).toEqual({ [RENE]: 'gold', [THOMAS]: 'silver', [CARSTEN]: 'bronze', [TOM]: 'poop' });
  });

  it('6) existing archived session without medals derives them from totals', () => {
    const legacy = { id: 'x', totals: delta(100, 50, 10, -160) }; // no medals field
    expect(medalsForArchived(legacy)).toEqual({
      [RENE]: 'gold', [THOMAS]: 'silver', [CARSTEN]: 'bronze', [TOM]: 'poop',
    });
  });
});

describe('medals — long-term aggregation and standings', () => {
  it('7+8) aggregates counts across evenings and computes medalPoints', () => {
    const archived = [
      { medals: { [RENE]: 'gold', [THOMAS]: 'silver', [CARSTEN]: 'bronze', [TOM]: 'poop' } },
      { medals: { [RENE]: 'gold', [THOMAS]: 'bronze', [CARSTEN]: 'silver', [TOM]: 'poop' } },
    ];
    const counts = aggregateMedalCounts(archived);
    expect(counts[RENE]).toEqual({ gold: 2, silver: 0, bronze: 0, poop: 0 });
    expect(computeMedalPoints(counts[RENE])).toBe(6); // 2*3
    expect(computeMedalPoints(counts[THOMAS])).toBe(3); // silver(2)+bronze(1)
    expect(computeMedalPoints(counts[TOM])).toBe(0); // two poop
  });

  it('9) standings rank by medalPoints, NOT cumulative point score', () => {
    // René wins one huge evening; Thomas wins two close evenings → Thomas more medal points,
    // but René has far more cumulative points.
    const archived = [
      { totals: delta(1000, 1, -1, -1000) }, // René gold, huge points
      { totals: delta(5, 10, -5, -10) }, // Thomas gold, René silver
      { totals: delta(5, 10, -5, -10) }, // Thomas gold, René silver
    ];
    const standings = buildMedalStandings(archived, []);
    expect(standings[0].player).toBe(THOMAS); // 2 gold + 1 silver = 8
    expect(standings[0].medalPoints).toBe(8);
    const rene = standings.find((s) => s.player === RENE);
    expect(rene.medalPoints).toBe(7); // gold + 2 silver
    // René has the highest cumulative score yet ranks BELOW Thomas.
    expect(rene.cumulativeScore).toBeGreaterThan(standings[0].cumulativeScore);
    expect(standings.findIndex((s) => s.player === RENE)).toBe(1);
  });

  it('10) deleting an evening recomputes counts and medalPoints', () => {
    const archived = [
      { id: 'e1', medals: { [RENE]: 'gold', [THOMAS]: 'silver', [CARSTEN]: 'bronze', [TOM]: 'poop' } },
      { id: 'e2', medals: { [RENE]: 'gold', [THOMAS]: 'silver', [CARSTEN]: 'bronze', [TOM]: 'poop' } },
    ];
    const remaining = archived.filter((a) => a.id !== 'e2'); // delete e2
    const counts = aggregateMedalCounts(remaining);
    expect(counts[RENE]).toEqual({ gold: 1, silver: 0, bronze: 0, poop: 0 });
    expect(computeMedalPoints(counts[RENE])).toBe(3);
  });

  it('12) provisional medals reflect only the current active evening', () => {
    const archived = [{ totals: delta(0, 0, 0, 0), medals: computeMedalsForTotals(delta(0, 0, 0, 0)) }];
    const currentHands = [{ delta: delta(50, -10, -10, -30) }]; // René leads the active evening
    const standings = buildMedalStandings(archived, currentHands);
    const rene = standings.find((s) => s.player === RENE);
    expect(rene.provisional).toBe('gold'); // provisional from current evening only
    // archived evening was all-zero → everyone gold there, so counts don't reflect the active lead
    expect(buildMedalStandings(archived, []).find((s) => s.player === RENE).provisional).toBeNull();
  });
});
