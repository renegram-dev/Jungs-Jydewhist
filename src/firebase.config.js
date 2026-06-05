// Firebase web config for "Delt spil" (shared game) mode.
//
// IMPORTANT: this web config is NOT a secret. Security is enforced by Firestore
// rules (see firestore.rules), not by hiding these values. While the fields are
// blank the app stays in LOCAL-ONLY mode and shared mode is hidden/disabled.
//
// To enable shared mode, either:
//   (a) paste your Firebase project's web config into HARDCODED below and commit, or
//   (b) set VITE_FIREBASE_* env vars (these take precedence — useful for CI).
// See README → "Delt spil (shared game mode)".

// Firebase project "jungs-jydewhist" web config (NOT a secret — see note above).
const HARDCODED = {
  apiKey: 'AIzaSyDbTsqwbKNXN1gybjYwi2uioNzEhBd77qU',
  authDomain: 'jungs-jydewhist.firebaseapp.com',
  projectId: 'jungs-jydewhist',
  storageBucket: 'jungs-jydewhist.firebasestorage.app',
  messagingSenderId: '785276642256',
  appId: '1:785276642256:web:3f046aa2d2137b29e74fd5',
};

function fromEnv(key, fallback) {
  const v = import.meta.env?.[key];
  return v != null && v !== '' ? v : fallback;
}

export const firebaseConfig = {
  apiKey: fromEnv('VITE_FIREBASE_API_KEY', HARDCODED.apiKey),
  authDomain: fromEnv('VITE_FIREBASE_AUTH_DOMAIN', HARDCODED.authDomain),
  projectId: fromEnv('VITE_FIREBASE_PROJECT_ID', HARDCODED.projectId),
  storageBucket: fromEnv('VITE_FIREBASE_STORAGE_BUCKET', HARDCODED.storageBucket),
  messagingSenderId: fromEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', HARDCODED.messagingSenderId),
  appId: fromEnv('VITE_FIREBASE_APP_ID', HARDCODED.appId),
};

// Shared mode is only offered when the essential fields are present.
export function isFirebaseConfigured() {
  const c = firebaseConfig;
  return Boolean(c.apiKey && c.projectId && c.appId);
}
