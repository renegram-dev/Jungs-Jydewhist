// Firestore-backed shared game ("Delt spil"). One document per game at
// sharedGames/{roomCode}. Firestore is the source of truth in shared mode.
// Only the host (hostUid) may write; everyone authenticated who knows the room
// code may read. See firestore.rules.

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { getFirebase, signInShared } from './firebase.js';
import { PLAYERS } from './scoring.js';
import { generateRoomCode, isValidSharedDoc } from './sharedGameUtils.js';

// Re-export pure helpers + auth so callers need only this module.
export { signInShared, isFirebaseConfigured } from './firebase.js';
export {
  generateRoomCode,
  normalizeRoomCode,
  isValidRoomCode,
  buildShareLink,
  mapSharedDocToSession,
} from './sharedGameUtils.js';

export const SCORING_VERSION = 2; // bumped when VIP-by-trump-card scoring landed
export const APP_VERSION = '1.0.0';
const COLLECTION = 'sharedGames';

function gameRef(roomCode) {
  const fb = getFirebase();
  if (!fb) throw new Error('Firebase er ikke konfigureret.');
  return doc(fb.db, COLLECTION, roomCode);
}

async function readHands(roomCode) {
  const snap = await getDoc(gameRef(roomCode));
  return snap.exists() && Array.isArray(snap.data().hands) ? snap.data().hands : [];
}

/**
 * Create a new shared game, seeded from the given local session (its name +
 * hands carry over). Signs in anonymously first. Returns { roomCode, hostUid }.
 */
export async function createSharedGameFromSession(session) {
  const user = await signInShared();
  let roomCode = generateRoomCode();
  if ((await getDoc(gameRef(roomCode))).exists()) roomCode = generateRoomCode(); // one retry
  const data = {
    roomCode,
    hostUid: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    sessionName: session && session.name ? session.name : 'Delt spil',
    players: [...PLAYERS],
    hands: session && Array.isArray(session.hands) ? session.hands : [],
    scoringVersion: SCORING_VERSION,
    appVersion: APP_VERSION,
  };
  await setDoc(gameRef(roomCode), data);
  return { roomCode, hostUid: user.uid };
}

/** Join (one-time read) a shared game. Returns { data, uid, isHost }. */
export async function joinSharedGame(roomCode) {
  const user = await signInShared();
  const snap = await getDoc(gameRef(roomCode));
  if (!snap.exists()) throw new Error('Delt spil findes ikke – tjek koden.');
  const data = snap.data();
  if (!isValidSharedDoc(data)) throw new Error('Delt spil har et ugyldigt format.');
  return { data, uid: user.uid, isHost: data.hostUid === user.uid };
}

/**
 * Live-subscribe to a shared game. callback receives
 * { exists, data, fromCache, hasPendingWrites } or { error }. Returns unsubscribe.
 */
export function subscribeToSharedGame(roomCode, callback) {
  let ref;
  try {
    ref = gameRef(roomCode);
  } catch (error) {
    callback({ error });
    return () => {};
  }
  return onSnapshot(
    ref,
    { includeMetadataChanges: true },
    (snap) =>
      callback({
        exists: snap.exists(),
        data: snap.exists() ? snap.data() : null,
        fromCache: snap.metadata.fromCache,
        hasPendingWrites: snap.metadata.hasPendingWrites,
      }),
    (error) => callback({ error }),
  );
}

// --- Host-only mutations (rules enforce hostUid). Zero-sum/validation happens
//     before hands reach here, exactly as in local mode. ---

export async function addSharedHand(roomCode, hand) {
  const hands = await readHands(roomCode);
  await updateDoc(gameRef(roomCode), { hands: [...hands, hand], updatedAt: serverTimestamp() });
}

export async function undoSharedHand(roomCode) {
  const hands = await readHands(roomCode);
  await updateDoc(gameRef(roomCode), { hands: hands.slice(0, -1), updatedAt: serverTimestamp() });
}

export async function clearSharedGame(roomCode) {
  await updateDoc(gameRef(roomCode), { hands: [], updatedAt: serverTimestamp() });
}

export async function deleteSharedHand(roomCode, handId) {
  const hands = await readHands(roomCode);
  await updateDoc(gameRef(roomCode), {
    hands: hands.filter((h) => h.id !== handId),
    updatedAt: serverTimestamp(),
  });
}

export async function updateSharedGame(roomCode, patch) {
  await updateDoc(gameRef(roomCode), { ...patch, updatedAt: serverTimestamp() });
}

export async function deleteSharedGame(roomCode) {
  await deleteDoc(gameRef(roomCode));
}
