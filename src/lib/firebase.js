// Firebase initialization + Google sign-in. Imported lazily (dynamic import of
// historyStore.js) so the Firebase SDK is only fetched once the app starts.
//
// ONLINE-ONLY by design: Firestore uses an in-memory cache (no IndexedDB
// persistence), so nothing from a previous session can masquerade as current data.

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, getFirestore, memoryLocalCache } from 'firebase/firestore';
import { firebaseConfig, isFirebaseConfigured } from '../firebase.config.js';

let cached = null;

/** Returns { app, auth, db } or null when Firebase is not configured. */
export function getFirebase() {
  if (!isFirebaseConfigured()) return null;
  if (cached) return cached;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  let db;
  try {
    db = initializeFirestore(app, { localCache: memoryLocalCache() });
  } catch {
    db = getFirestore(app); // already initialised (e.g. dev hot reload)
  }
  cached = { app, auth: getAuth(app), db };
  return cached;
}

export { isFirebaseConfigured };
