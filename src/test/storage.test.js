import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDefaultState,
  createSession,
  addHand,
  makeHand,
  clearSession,
  undoLastHand,
  exportAppState,
  importAppState,
  loadAppState,
  saveAppState,
  getActiveSession,
} from '../lib/storage.js';
import { calculateHandScore, PLAYERS } from '../lib/scoring.js';
import { computeTotals } from '../state/selectors.js';

const [RENE, THOMAS, CARSTEN, TOM] = PLAYERS;

// Build a real, valid hand (René 7 with Thomas, 7 tricks -> ±10).
function sampleHand() {
  const input = { contractId: 0, declarer: RENE, partnerMode: 'partner', partner: THOMAS, tricks: 7 };
  const calc = calculateHandScore(input);
  return makeHand({ ...input, calc, manualOverride: false });
}

describe('default state', () => {
  it('creates exactly one active session with the four fixed players', () => {
    const state = createDefaultState();
    expect(state.sessions).toHaveLength(1);
    expect(state.activeSessionId).toBe(state.sessions[0].id);
    expect(state.sessions[0].players).toEqual([...PLAYERS]);
    expect(state.sessions[0].hands).toEqual([]);
    expect(state.sessions[0].name).toMatch(/^Jungs-Jydewhist \d{4}-\d{2}-\d{2}$/);
  });
});

describe('session creation', () => {
  it('appends a new session and makes it active', () => {
    const s0 = createDefaultState();
    const { state: s1, session } = createSession(s0, 'Aftenkamp');
    expect(s1.sessions).toHaveLength(2);
    expect(s1.activeSessionId).toBe(session.id);
    expect(session.name).toBe('Aftenkamp');
  });
});

describe('clear and undo', () => {
  it('clearSession removes hands but keeps name + players', () => {
    let state = createDefaultState();
    const id = state.activeSessionId;
    state = addHand(state, id, sampleHand());
    state = addHand(state, id, sampleHand());
    const before = getActiveSession(state);
    expect(before.hands).toHaveLength(2);

    state = clearSession(state, id);
    const after = getActiveSession(state);
    expect(after.hands).toHaveLength(0);
    expect(after.name).toBe(before.name);
    expect(after.players).toEqual([...PLAYERS]);
    expect(computeTotals(after.hands)).toEqual({ [RENE]: 0, [THOMAS]: 0, [CARSTEN]: 0, [TOM]: 0 });
  });

  it('undoLastHand drops only the most recent hand', () => {
    let state = createDefaultState();
    const id = state.activeSessionId;
    state = addHand(state, id, sampleHand());
    state = addHand(state, id, sampleHand());
    state = undoLastHand(state, id);
    expect(getActiveSession(state).hands).toHaveLength(1);
  });
});

describe('export / import', () => {
  it('round-trips a backup as a NEW session, leaving originals intact', () => {
    let state = createDefaultState();
    const id = state.activeSessionId;
    state = addHand(state, id, sampleHand());

    const backup = exportAppState(state);
    const result = importAppState(state, backup);

    expect(result.ok).toBe(true);
    // Original session still there + one imported session.
    expect(result.state.sessions).toHaveLength(2);
    expect(result.state.sessions[0].id).toBe(id); // original untouched
    const imported = result.state.sessions[result.state.sessions.length - 1];
    expect(imported.id).not.toBe(id); // fresh id, no overwrite
    expect(result.state.activeSessionId).toBe(imported.id);
    expect(imported.hands).toHaveLength(1);
    expect(computeTotals(imported.hands)[RENE]).toBe(10);
  });

  it('imports a single bare session object too', () => {
    const state = createDefaultState();
    const session = {
      name: 'Importeret',
      players: [...PLAYERS],
      hands: [sampleHand()],
    };
    const result = importAppState(state, JSON.stringify(session));
    expect(result.ok).toBe(true);
    expect(result.state.sessions).toHaveLength(2);
  });

  it('rejects a backup whose hand delta is not zero-sum', () => {
    const state = createDefaultState();
    const bad = sampleHand();
    bad.delta = { [RENE]: 10, [THOMAS]: 10, [CARSTEN]: -10, [TOM]: -9 }; // sums to +1
    const session = { name: 'Korrupt', players: [...PLAYERS], hands: [bad] };
    const result = importAppState(state, JSON.stringify(session));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/nul-sum|delta/i);
  });

  it('rejects a backup with a different player set', () => {
    const state = createDefaultState();
    const session = { name: 'Andre spillere', players: ['A', 'B', 'C', 'D'], hands: [] };
    const result = importAppState(state, JSON.stringify(session));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/spiller/i);
  });

  it('rejects invalid JSON', () => {
    const state = createDefaultState();
    const result = importAppState(state, '{not json');
    expect(result.ok).toBe(false);
  });

  it('rejects a tampered non-override hand whose delta does not match the calculation', () => {
    const state = createDefaultState();
    const tampered = sampleHand(); // genuinely ±10
    tampered.delta = { [RENE]: 12, [THOMAS]: 12, [CARSTEN]: -12, [TOM]: -12 }; // zero-sum but wrong
    const session = { name: 'Manipuleret', players: [...PLAYERS], hands: [tampered] };
    const result = importAppState(state, JSON.stringify(session));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/beregn/i);
  });
});

// A real VIP hand: 7 VIP (contractId 3) with Thomas, 7 tricks, chosen position.
function vipHand(pos) {
  const input = { contractId: 3, declarer: RENE, partnerMode: 'partner', partner: THOMAS, tricks: 7, vipPosition: pos };
  const calc = calculateHandScore(input);
  return makeHand({ ...input, calc, manualOverride: false });
}

describe('VIP import handling', () => {
  it('round-trips a VIP hand, preserving vipPosition and score', () => {
    const session = { name: 'VIP', players: [...PLAYERS], hands: [vipHand(2)] };
    const result = importAppState(createDefaultState(), JSON.stringify(session));
    expect(result.ok).toBe(true);
    const imported = result.state.sessions[result.state.sessions.length - 1];
    expect(imported.hands[0].vipPosition).toBe(2);
    expect(imported.hands[0].delta[RENE]).toBe(20);
  });

  it('accepts a legacy VIP hand without vipPosition and keeps its stored delta', () => {
    const legacy = vipHand(2);
    delete legacy.vipPosition; // v1-style hand
    const session = { name: 'Gammel VIP', players: [...PLAYERS], hands: [legacy] };
    const result = importAppState(createDefaultState(), JSON.stringify(session));
    expect(result.ok).toBe(true);
    const imported = result.state.sessions[result.state.sessions.length - 1];
    expect(imported.hands[0].vipPosition).toBeNull();
    expect(imported.hands[0].delta[RENE]).toBe(20); // stored delta kept
  });

  it('rejects a non-legacy VIP hand whose delta does not match its position', () => {
    const bad = vipHand(2); // genuinely ±20
    bad.delta = { [RENE]: 21, [THOMAS]: 21, [CARSTEN]: -21, [TOM]: -21 }; // zero-sum but wrong for pos 2
    const session = { name: 'Forkert VIP', players: [...PLAYERS], hands: [bad] };
    const result = importAppState(createDefaultState(), JSON.stringify(session));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/beregn/i);
  });
});

describe('localStorage load/save (jsdom)', () => {
  beforeEach(() => localStorage.clear());

  it('returns a fresh default when nothing is stored', () => {
    const state = loadAppState();
    expect(state.sessions).toHaveLength(1);
  });

  it('persists and reloads state', () => {
    let state = createDefaultState();
    const id = state.activeSessionId;
    state = addHand(state, id, sampleHand());
    expect(saveAppState(state).ok).toBe(true);

    const reloaded = loadAppState();
    expect(reloaded.activeSessionId).toBe(id);
    expect(computeTotals(getActiveSession(reloaded).hands)[RENE]).toBe(10);
  });

  it('recovers to a default when stored JSON is corrupt', () => {
    localStorage.setItem('jungs-jydewhist.v1', '{broken');
    const state = loadAppState();
    expect(state.sessions).toHaveLength(1);
  });
});
