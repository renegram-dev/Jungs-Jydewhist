// Single source of truth for the whole app.
//
// CLOUD-FIRST, ONLINE-ONLY: the one permanent history lives in Firestore
// (history/main). There is no local mode and no offline fallback — if the cloud
// cannot be reached the app says so and shows no scores. Every write is awaited
// and only reported as successful after Firestore has committed it.
//
// The Firebase SDK is only loaded (dynamic import of historyStore.js) once the
// provider mounts. With VITE_E2E=1 a test-only in-memory store replaces it.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { computeTotals } from './selectors.js';
import { isFirebaseConfigured } from '../firebase.config.js';
import {
  mapSharedDocToSession,
  getArchivedSessions,
  cumulativeTotals as computeCumulativeTotals,
  buildMedalStandings,
  computeMedalsForTotals,
} from '../lib/sharedGameUtils.js';
import { buildExport, parseExport } from '../lib/historyOps.js';

const AppStateContext = createContext(null);

const E2E = import.meta.env.VITE_E2E === '1';

let storePromise = null;
function loadStore() {
  if (!storePromise) {
    storePromise = E2E ? import('../lib/historyStoreFake.js') : import('../lib/historyStore.js');
  }
  return storePromise;
}

export function errMsg(e) {
  const m = e && e.message ? e.message : String(e || 'Ukendt fejl');
  const code = e && e.code ? String(e.code) : '';
  if (/permission[-_ ]denied|insufficient permissions/i.test(m + code)) {
    return 'Ingen adgang. Denne Google-konto er ikke godkendt.';
  }
  if (/unavailable|offline|network/i.test(m + code)) {
    return 'Ingen forbindelse til Firebase. Intet er gemt.';
  }
  if (/popup-closed|cancelled-popup/i.test(code)) return 'Login blev afbrudt.';
  if (/popup-blocked/i.test(code)) return 'Browseren blokerede login-vinduet. Tillad pop-ups og prøv igen.';
  return m;
}

export function AppStateProvider({ children }) {
  const firebaseReady = E2E || isFirebaseConfigured();

  // auth: 'loading' | 'out' | 'in'
  const [auth, setAuth] = useState(firebaseReady ? 'loading' : 'out');
  const [authError, setAuthError] = useState(null);
  // data: 'idle' | 'loading' | 'live' | 'offline' | 'missing' | 'error'
  const [dataStatus, setDataStatus] = useState('idle');
  const [dataError, setDataError] = useState(null);
  const [sharedData, setSharedData] = useState(null);
  const [writeError, setWriteError] = useState(null);
  const [browserOnline, setBrowserOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  );
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const on = () => setBrowserOnline(true);
    const off = () => setBrowserOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // Auth state (restores the Google session on every launch / device).
  useEffect(() => {
    if (!firebaseReady) return undefined;
    let active = true;
    let unsub = () => {};
    loadStore()
      .then((s) => {
        if (!active) return;
        unsub = s.watchAuth((evt) => {
          if (!active) return;
          if (evt.error) {
            setAuthError(errMsg(evt.error));
            setAuth('out');
            return;
          }
          setAuth(evt.user ? 'in' : 'out');
        });
      })
      .catch((e) => {
        if (active) {
          setAuthError(errMsg(e));
          setAuth('out');
        }
      });
    return () => {
      active = false;
      unsub();
    };
  }, [firebaseReady]);

  // Live subscription — only while signed in. Signing out drops all data.
  useEffect(() => {
    if (auth !== 'in') {
      setSharedData(null);
      setDataStatus('idle');
      setDataError(null);
      return undefined;
    }
    let active = true;
    let unsub = () => {};
    setDataStatus('loading');
    setDataError(null);
    loadStore()
      .then((s) => {
        if (!active) return;
        unsub = s.subscribeHistory((evt) => {
          if (!active) return;
          if (evt.error) {
            setSharedData(null);
            setDataError(errMsg(evt.error));
            setDataStatus('error');
            return;
          }
          if (evt.fromCache) {
            // Not confirmed by the server → never shown as current history.
            setDataStatus('offline');
            return;
          }
          if (!evt.exists) {
            setSharedData(null);
            setDataStatus('missing');
            return;
          }
          setSharedData(evt.data);
          setDataError(null);
          setDataStatus('live');
        });
      })
      .catch((e) => {
        if (active) {
          setDataError(errMsg(e));
          setDataStatus('error');
        }
      });
    return () => {
      active = false;
      unsub();
    };
  }, [auth, retryKey]);

  const signIn = useCallback(async () => {
    setAuthError(null);
    try {
      const s = await loadStore();
      await s.signInGoogle();
    } catch (e) {
      setAuthError(errMsg(e));
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      const s = await loadStore();
      await s.signOutUser();
    } catch (e) {
      setAuthError(errMsg(e));
    }
  }, []);

  const retry = useCallback(() => setRetryKey((k) => k + 1), []);

  // Effective connectivity: the data is only "live" if the server confirmed it AND
  // the browser reports being online. Otherwise the UI blocks with an overlay.
  const status =
    auth === 'loading'
      ? 'auth-loading'
      : auth === 'out'
      ? 'signed-out'
      : dataStatus === 'live' && !browserOnline
      ? 'offline'
      : dataStatus;
  const canEdit = status === 'live';

  // Run a store write; resolve { ok } only after Firestore acknowledged it.
  const write = useCallback(async (fn) => {
    setWriteError(null);
    try {
      const s = await loadStore();
      await fn(s);
      return { ok: true };
    } catch (e) {
      const msg = errMsg(e);
      setWriteError(msg);
      return { ok: false, error: msg };
    }
  }, []);

  const actions = useMemo(
    () => ({
      addHand: (hand) => write((s) => s.addHand(hand)),
      undoLast: () => write((s) => s.undoHand()),
      clearSession: () => write((s) => s.clearHands()),
      deleteHand: (id) => write((s) => s.deleteHand(id)),
      archiveSession: () => write((s) => s.archiveEvening()),
      deleteArchived: (id) => write((s) => s.deleteArchived(id)),
      importHistory: async (text) => {
        const parsed = parseExport(text);
        if (!parsed.ok) return parsed;
        return write((s) => s.importHistory(parsed.doc));
      },
      exportHistory: () => (sharedData ? buildExport(sharedData) : null),
      dismissWriteError: () => setWriteError(null),
      signIn,
      signOut,
      retry,
    }),
    [write, sharedData, signIn, signOut, retry],
  );

  const activeSession = useMemo(() => mapSharedDocToSession(sharedData), [sharedData]);
  const totals = useMemo(
    () => computeTotals(activeSession ? activeSession.hands : []),
    [activeSession],
  );
  const archivedSessions = useMemo(() => getArchivedSessions(sharedData), [sharedData]);
  const cumulativeTotals = useMemo(() => computeCumulativeTotals(sharedData), [sharedData]);
  const medalStandings = useMemo(
    () => buildMedalStandings(archivedSessions, activeSession ? activeSession.hands : []),
    [archivedSessions, activeSession],
  );
  const provisionalMedals = useMemo(
    () => (activeSession && activeSession.hands.length ? computeMedalsForTotals(totals) : null),
    [activeSession, totals],
  );

  const value = {
    firebaseReady,
    status, // auth-loading | signed-out | loading | live | offline | missing | error
    authError,
    dataError,
    writeError,
    canEdit,
    activeSession,
    totals,
    archivedSessions,
    cumulativeTotals,
    medalStandings,
    provisionalMedals,
    actions,
  };
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}
