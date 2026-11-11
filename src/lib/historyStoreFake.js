// TEST-ONLY in-memory stand-in for historyStore.js, used when the app is built or
// served with VITE_E2E=1 (see playwright.config.js / .env.e2e). It lets the
// browser smoke tests run without Firebase. It is never reachable in a normal
// production build (the import is dead-code-eliminated).
//
// Scenario switch via URL: ?e2e=signedout | offline | denied | missing | writefail

import {
  addHandPatch,
  undoPatch,
  clearPatch,
  deleteHandPatch,
  archivePatch,
  deleteArchivedPatch,
  validateHistoryDoc,
} from './historyOps.js';
import { PLAYERS } from './scoring.js';

const DB_KEY = 'e2e.history';
const USER_KEY = 'e2e.user';

function scenario() {
  return new URLSearchParams(window.location.search).get('e2e') || '';
}

function load() {
  try {
    const raw = sessionStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return null;
}

function save(data) {
  sessionStorage.setItem(DB_KEY, JSON.stringify(data));
  listeners.forEach((l) => l());
}

function initialDoc() {
  return {
    roomCode: 'main',
    sessionName: 'Aften',
    players: [...PLAYERS],
    hands: [],
    archivedSessions: [],
  };
}

const listeners = new Set();
const authListeners = new Set();

function currentUser() {
  return sessionStorage.getItem(USER_KEY) ? { uid: 'e2e-user' } : null;
}

export function watchAuth(cb) {
  if (scenario() !== 'signedout' && !sessionStorage.getItem(USER_KEY)) {
    sessionStorage.setItem(USER_KEY, '1');
  }
  const fn = () => cb({ user: currentUser() });
  authListeners.add(fn);
  setTimeout(fn, 0);
  return () => authListeners.delete(fn);
}

export async function signInGoogle() {
  sessionStorage.setItem(USER_KEY, '1');
  authListeners.forEach((f) => f());
}

export async function signOutUser() {
  sessionStorage.removeItem(USER_KEY);
  authListeners.forEach((f) => f());
}

export function subscribeHistory(cb) {
  const emit = () => {
    const s = scenario();
    if (s === 'denied') return cb({ error: new Error('PERMISSION_DENIED: insufficient permissions') });
    if (s === 'offline') return cb({ exists: false, data: null, fromCache: true });
    let data = load();
    if (!data && s !== 'missing') {
      data = initialDoc();
      sessionStorage.setItem(DB_KEY, JSON.stringify(data));
    }
    return cb({ exists: !!data, data, fromCache: false });
  };
  listeners.add(emit);
  setTimeout(emit, 0);
  return () => listeners.delete(emit);
}

async function mutate(patchFn) {
  if (scenario() === 'writefail') throw new Error('Kunne ikke nå Firestore (test).');
  const data = load();
  if (!data) throw new Error('Historikken findes ikke i skyen – intet er gemt.');
  const patch = patchFn(data);
  if (patch) save({ ...data, ...patch });
}

export const addHand = (hand) => mutate((d) => addHandPatch(d, hand));
export const undoHand = () => mutate((d) => undoPatch(d));
export const clearHands = () => mutate(() => clearPatch());
export const deleteHand = (id) => mutate((d) => deleteHandPatch(d, id));
export const archiveEvening = () => mutate((d) => archivePatch(d));
export const deleteArchived = (id) => mutate((d) => deleteArchivedPatch(d, id));

export async function importHistory(data) {
  const problems = validateHistoryDoc(data);
  if (problems.length) throw new Error(problems.join(' '));
  if (load()) throw new Error('Historikken findes allerede – import afvist.');
  save({ ...data, roomCode: 'main' });
}
