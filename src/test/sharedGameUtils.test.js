import { describe, it, expect } from 'vitest';
import {
  generateRoomCode,
  normalizeRoomCode,
  isValidRoomCode,
  buildShareLink,
  hasFixedPlayers,
  isValidSharedDoc,
  mapSharedDocToSession,
} from '../lib/sharedGameUtils.js';
import { PLAYERS } from '../lib/scoring.js';

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
