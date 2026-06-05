// localStorage persistence + session management for Jungs-Jydewhist.
//
// This module is the ONLY place that knows the storage schema. It depends on the
// pure scoring module (one-way) for validation, but scoring never depends on
// this file. The browser/device is the source of truth; totals are NEVER stored
// here — they are always recomputed from each hand's delta (see selectors.js).
//
// The CRUD functions are pure transforms over an AppState object. Only
// loadAppState / saveAppState actually touch localStorage; the React reducer is
// the single place that calls saveAppState.

import { PLAYERS, getContract, calculateHandScore, validateScoreDelta } from './scoring.js';

const STORAGE_KEY = 'jungs-jydewhist.v1';
const SCHEMA_VERSION = 1;
const VALID_MODES = ['partner', 'self', 'solo'];

// ---------------------------------------------------------------------------
// Schema
//   AppState = { version, sessions: Session[], activeSessionId }
//   Session  = { id, name, createdAt, updatedAt, players[4], hands: Hand[] }
//   Hand     = { id, timestamp, declarer, contractId, contractLabel,
//                partnerMode, partner, tricks, success, delta, explanation,
//                manualOverride }
// The visible hand number is DERIVED from list position (selectors.js), not
// stored — deleting a hand renumbers the rest.
// ---------------------------------------------------------------------------

export function newId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function todayISODate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function defaultSessionName(date = new Date()) {
  return `Jungs-Jydewhist ${todayISODate(date)}`;
}

export function createSessionObject(name) {
  const now = new Date().toISOString();
  return {
    id: newId(),
    name: name && String(name).trim() ? String(name).trim() : defaultSessionName(),
    createdAt: now,
    updatedAt: now,
    players: [...PLAYERS], // fixed players for the MVP
    hands: [],
  };
}

export function createDefaultState() {
  const session = createSessionObject();
  return { version: SCHEMA_VERSION, sessions: [session], activeSessionId: session.id };
}

function mostRecent(sessions) {
  return [...sessions].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0];
}

// ---------------------------------------------------------------------------
// localStorage I/O (the only impure functions)
// ---------------------------------------------------------------------------

export function loadAppState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const repaired = repairState(JSON.parse(raw));
    return repaired || createDefaultState();
  } catch {
    // Corrupt JSON / private mode read error — never crash, start fresh.
    return createDefaultState();
  }
}

export function saveAppState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { ok: true };
  } catch (error) {
    // Quota exceeded or Safari private mode — surface to the UI, keep in memory.
    return { ok: false, error };
  }
}

// Lenient repair of state read back from storage. Returns null to signal
// "unusable, fall back to a fresh default".
function repairState(state) {
  if (!state || typeof state !== 'object' || !Array.isArray(state.sessions)) return null;
  const sessions = state.sessions
    .map((s) => {
      if (!s || typeof s !== 'object') return null;
      const now = new Date().toISOString();
      return {
        id: typeof s.id === 'string' && s.id ? s.id : newId(),
        name: typeof s.name === 'string' && s.name.trim() ? s.name : defaultSessionName(),
        createdAt: typeof s.createdAt === 'string' ? s.createdAt : now,
        updatedAt: typeof s.updatedAt === 'string' ? s.updatedAt : now,
        players: [...PLAYERS],
        hands: Array.isArray(s.hands) ? s.hands : [],
      };
    })
    .filter(Boolean);
  if (sessions.length === 0) return null;
  let activeSessionId = state.activeSessionId;
  if (!sessions.some((s) => s.id === activeSessionId)) activeSessionId = mostRecent(sessions).id;
  return { version: SCHEMA_VERSION, sessions, activeSessionId };
}

// ---------------------------------------------------------------------------
// Pure CRUD transforms over AppState
// ---------------------------------------------------------------------------

export function getActiveSession(state) {
  return state.sessions.find((s) => s.id === state.activeSessionId) || null;
}

export function createSession(state, name) {
  const session = createSessionObject(name);
  return {
    state: { ...state, sessions: [...state.sessions, session], activeSessionId: session.id },
    session,
  };
}

export function selectSession(state, id) {
  if (!state.sessions.some((s) => s.id === id)) return state;
  return { ...state, activeSessionId: id };
}

function patchSession(state, id, patch) {
  return {
    ...state,
    sessions: state.sessions.map((s) =>
      s.id === id ? { ...s, ...patch, id: s.id, players: [...PLAYERS], updatedAt: new Date().toISOString() } : s,
    ),
  };
}

export function renameSession(state, id, name) {
  const clean = name && String(name).trim() ? String(name).trim() : defaultSessionName();
  return patchSession(state, id, { name: clean });
}

export function deleteSession(state, id) {
  const sessions = state.sessions.filter((s) => s.id !== id);
  if (sessions.length === 0) return createDefaultState();
  let activeSessionId = state.activeSessionId;
  if (activeSessionId === id) activeSessionId = mostRecent(sessions).id;
  return { ...state, sessions, activeSessionId };
}

// Build a Hand from a scoring result (+ optional manual override delta).
export function makeHand({ contractId, declarer, partnerMode, partner, tricks, calc, manualOverride, delta }) {
  return {
    id: newId(),
    timestamp: new Date().toISOString(),
    declarer,
    contractId,
    contractLabel: calc.contractLabel,
    partnerMode,
    partner: partnerMode === 'partner' ? partner : null,
    tricks,
    success: calc.success,
    delta: { ...(delta || calc.delta) },
    explanation: calc.explanation,
    manualOverride: !!manualOverride,
  };
}

export function addHand(state, sessionId, hand) {
  return {
    ...state,
    sessions: state.sessions.map((s) =>
      s.id === sessionId
        ? { ...s, hands: [...s.hands, hand], updatedAt: new Date().toISOString() }
        : s,
    ),
  };
}

export function deleteHand(state, sessionId, handId) {
  return {
    ...state,
    sessions: state.sessions.map((s) =>
      s.id === sessionId
        ? { ...s, hands: s.hands.filter((h) => h.id !== handId), updatedAt: new Date().toISOString() }
        : s,
    ),
  };
}

// "Fortryd seneste spil" — remove the most recently added hand.
export function undoLastHand(state, sessionId) {
  return {
    ...state,
    sessions: state.sessions.map((s) =>
      s.id === sessionId ? { ...s, hands: s.hands.slice(0, -1), updatedAt: new Date().toISOString() } : s,
    ),
  };
}

// "Nulstil aktuel session" — drop all hands, keep name + players, totals -> 0.
export function clearSession(state, sessionId) {
  return {
    ...state,
    sessions: state.sessions.map((s) =>
      s.id === sessionId ? { ...s, hands: [], updatedAt: new Date().toISOString() } : s,
    ),
  };
}

// ---------------------------------------------------------------------------
// Backup export / import
// ---------------------------------------------------------------------------

export function exportAppState(state) {
  return JSON.stringify(state, null, 2);
}

// Validate one imported hand against the fixed rules and player set.
function validateImportedHand(h) {
  if (!h || typeof h !== 'object') return 'Ugyldig hånd i backup.';
  const contract = getContract(h.contractId);
  if (!contract) return `Ukendt kontrakt-id: ${h.contractId}.`;
  if (!Number.isInteger(h.tricks) || h.tricks < 0 || h.tricks > 13) return 'Stik skal være 0–13.';
  if (!VALID_MODES.includes(h.partnerMode)) return `Ugyldig makker-tilstand: ${h.partnerMode}.`;
  if (!PLAYERS.includes(h.declarer)) return `Ukendt melder: ${h.declarer}.`;

  if (contract.isSolo && h.partnerMode !== 'solo') return 'Sol/Ren sol skal være solo.';
  if (!contract.isSolo && h.partnerMode === 'solo') return 'Almindelig kontrakt kan ikke være solo.';
  if (h.partnerMode === 'partner') {
    if (!PLAYERS.includes(h.partner)) return `Ukendt makker: ${h.partner}.`;
    if (h.partner === h.declarer) return 'Melder kan ikke være sin egen makker.';
  }

  if (!validateScoreDelta(h.delta)) return 'Score-delta er ikke nul-sum / mangler spillere.';

  // Data-integrity guard: a non-overridden hand must match recomputed scoring.
  if (!h.manualOverride) {
    const calc = calculateHandScore({
      contractId: h.contractId,
      declarer: h.declarer,
      partnerMode: h.partnerMode,
      partner: h.partner,
      tricks: h.tricks,
    });
    if (calc.success !== !!h.success) return 'Resultat (vundet/tabt) matcher ikke beregningen.';
    for (const p of PLAYERS) {
      if (calc.delta[p] !== h.delta[p]) return 'Score-delta matcher ikke den beregnede score.';
    }
  }
  return null; // valid
}

function normalizeImportedHand(h) {
  const contract = getContract(h.contractId);
  return {
    id: newId(),
    timestamp: typeof h.timestamp === 'string' ? h.timestamp : new Date().toISOString(),
    declarer: h.declarer,
    contractId: h.contractId,
    contractLabel: contract.label,
    partnerMode: h.partnerMode,
    partner: h.partnerMode === 'partner' ? h.partner : null,
    tricks: h.tricks,
    success: !!h.success,
    delta: { ...h.delta },
    explanation: typeof h.explanation === 'string' ? h.explanation : '',
    manualOverride: !!h.manualOverride,
  };
}

function samePlayerSet(players) {
  return (
    Array.isArray(players) &&
    players.length === PLAYERS.length &&
    PLAYERS.every((p) => players.includes(p))
  );
}

// Validate and normalize a single imported session. Players MUST match the
// fixed four exactly (MVP rule) or the session is rejected.
function validateImportedSession(s) {
  if (!s || typeof s !== 'object') return { ok: false, error: 'Ugyldig session i backup.' };
  if (!samePlayerSet(s.players)) {
    return { ok: false, error: 'Spillerne i backup matcher ikke René, Thomas, Carsten, Tom.' };
  }
  if (!Array.isArray(s.hands)) return { ok: false, error: 'Sessionen mangler en hånd-liste.' };
  for (const h of s.hands) {
    const err = validateImportedHand(h);
    if (err) return { ok: false, error: err };
  }
  const now = new Date().toISOString();
  return {
    ok: true,
    session: {
      id: newId(), // fresh id — never collide with or overwrite existing sessions
      name: typeof s.name === 'string' && s.name.trim() ? s.name.trim() : defaultSessionName(),
      createdAt: now,
      updatedAt: now,
      players: [...PLAYERS],
      hands: s.hands.map(normalizeImportedHand),
    },
  };
}

/**
 * Import a backup. Accepts a full AppState (with sessions[]) or a single Session
 * object. SAFE BY DESIGN: validated sessions are appended as brand-new sessions;
 * nothing existing is ever overwritten. Returns { ok, state?, importedSessionIds?, error? }.
 */
export function importAppState(state, jsonOrText) {
  let parsed;
  try {
    parsed = typeof jsonOrText === 'string' ? JSON.parse(jsonOrText) : jsonOrText;
  } catch {
    return { ok: false, error: 'Ugyldig JSON — kunne ikke læse filen.' };
  }

  let incoming;
  if (parsed && Array.isArray(parsed.sessions)) incoming = parsed.sessions;
  else if (parsed && Array.isArray(parsed.hands)) incoming = [parsed];
  else return { ok: false, error: 'Filen indeholder hverken en session eller en backup.' };

  if (incoming.length === 0) return { ok: false, error: 'Ingen sessioner at importere.' };

  const validated = [];
  for (const s of incoming) {
    const v = validateImportedSession(s);
    if (!v.ok) return { ok: false, error: v.error };
    validated.push(v.session);
  }

  const nextState = {
    ...state,
    sessions: [...state.sessions, ...validated],
    activeSessionId: validated[validated.length - 1].id,
  };
  return { ok: true, state: nextState, importedSessionIds: validated.map((s) => s.id) };
}

export const __STORAGE_KEY = STORAGE_KEY;
