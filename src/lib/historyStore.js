// Firestore-backed history: ONE document, history/main. Firestore is the only
// source of truth. Every write is a transaction and resolves only after the
// server has committed it; if the client is offline the transaction rejects
// (nothing is queued, nothing is silently "saved").
//
// Access is limited by firestore.rules to the single owner Google account.

import {
  doc,
  runTransaction,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { getFirebase } from './firebase.js';
import {
  HISTORY_COLLECTION,
  HISTORY_DOC_ID,
  addHandPatch,
  undoPatch,
  clearPatch,
  deleteHandPatch,
  archivePatch,
  deleteArchivedPatch,
  validateHistoryDoc,
} from './historyOps.js';

function fb() {
  const f = getFirebase();
  if (!f) throw new Error('Firebase er ikke konfigureret.');
  return f;
}

function historyRef() {
  return doc(fb().db, HISTORY_COLLECTION, HISTORY_DOC_ID);
}

// --- Auth ---

/** cb({ user } | { error }); returns unsubscribe. */
export function watchAuth(cb) {
  let f;
  try {
    f = fb();
  } catch (error) {
    cb({ error });
    return () => {};
  }
  return onAuthStateChanged(
    f.auth,
    (user) => cb({ user: user ? { uid: user.uid } : null }),
    (error) => cb({ error }),
  );
}

/** Must be called directly from a click handler (popup blockers, iOS Safari). */
export async function signInGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await signInWithPopup(fb().auth, provider);
}

export async function signOutUser() {
  await signOut(fb().auth);
}

// --- Live data ---

/** cb({ exists, data, fromCache } | { error }); returns unsubscribe. */
export function subscribeHistory(cb) {
  let ref;
  try {
    ref = historyRef();
  } catch (error) {
    cb({ error });
    return () => {};
  }
  return onSnapshot(
    ref,
    { includeMetadataChanges: true },
    (snap) =>
      cb({
        exists: snap.exists(),
        data: snap.exists() ? snap.data() : null,
        fromCache: snap.metadata.fromCache,
      }),
    (error) => cb({ error }),
  );
}

// --- Writes (transactional, server-acknowledged) ---

async function mutate(patchFn) {
  const f = fb();
  const ref = historyRef();
  await runTransaction(f.db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Historikken findes ikke i skyen – intet er gemt.');
    const patch = patchFn(snap.data());
    if (patch) tx.update(ref, { ...patch, updatedAt: serverTimestamp() });
  });
}

export const addHand = (hand) => mutate((d) => addHandPatch(d, hand));
export const undoHand = () => mutate((d) => undoPatch(d));
export const clearHands = () => mutate(() => clearPatch());
export const deleteHand = (handId) => mutate((d) => deleteHandPatch(d, handId));
export const archiveEvening = () => mutate((d) => archivePatch(d));
export const deleteArchived = (archiveId) => mutate((d) => deleteArchivedPatch(d, archiveId));

/** Create-only (rules + transaction): refuses if history/main already exists. */
export async function importHistory(data) {
  const problems = validateHistoryDoc(data);
  if (problems.length) throw new Error(problems.join(' '));
  const f = fb();
  const ref = historyRef();
  await runTransaction(f.db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) throw new Error('Historikken findes allerede – import afvist.');
    tx.set(ref, {
      ...data,
      roomCode: HISTORY_DOC_ID,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}
