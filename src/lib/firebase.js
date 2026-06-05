// Firebase initialization + anonymous auth. Imported lazily (via dynamic import
// of sharedGame.js) so the Firebase SDK is only fetched when shared mode is used.

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig, isFirebaseConfigured } from '../firebase.config.js';

let cached = null;

/** Returns { app, auth, db } or null when Firebase is not configured. */
export function getFirebase() {
  if (!isFirebaseConfigured()) return null;
  if (cached) return cached;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  cached = { app, auth: getAuth(app), db: getFirestore(app) };
  return cached;
}

/** Sign in anonymously (no username/password). Returns the Firebase user. */
export async function signInShared() {
  const fb = getFirebase();
  if (!fb) throw new Error('Firebase er ikke konfigureret.');
  if (fb.auth.currentUser) return fb.auth.currentUser;
  const cred = await signInAnonymously(fb.auth);
  return cred.user;
}

export { isFirebaseConfigured };
