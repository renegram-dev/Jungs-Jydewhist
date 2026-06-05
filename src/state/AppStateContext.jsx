// Single source of truth for the whole app.
//
// LOCAL mode: state is loaded from / persisted to localStorage (unchanged).
// SHARED mode ("Delt spil"): when a roomCode is active, the current session and
// totals come from a live Firestore document, and editing actions write to
// Firestore instead of localStorage. The Firebase SDK is only loaded (via a
// dynamic import of sharedGame.js) when shared mode is actually used.

import React, {
  createContext,
  useCallback,
  useContext,
  useReducer,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  loadAppState,
  saveAppState,
  getActiveSession,
  createSession,
  selectSession,
  renameSession,
  deleteSession,
  addHand,
  deleteHand,
  undoLastHand,
  clearSession,
  importAppState,
  exportAppState,
} from '../lib/storage.js';
import { computeTotals } from './selectors.js';
import { isFirebaseConfigured } from '../firebase.config.js';
import {
  normalizeRoomCode,
  isValidRoomCode,
  buildShareLink,
  mapSharedDocToSession,
  getArchivedSessions,
  cumulativeTotals as computeCumulativeTotals,
  buildMedalStandings,
  computeMedalsForTotals,
} from '../lib/sharedGameUtils.js';
import {
  recordSharedRoom,
  updateRecentRoomName,
  clearLastSharedRoom,
  getLastSharedRoomCode,
  getRecentSharedRooms,
} from '../lib/sharedMeta.js';

const AppStateContext = createContext(null);

// Lazy-load the Firestore layer (and the Firebase SDK) only when shared mode is
// used, so local-only users never download it.
let sharedModPromise = null;
function loadShared() {
  return (sharedModPromise ||= import('../lib/sharedGame.js'));
}

function errMsg(e) {
  const m = e && e.message ? e.message : String(e || 'Ukendt fejl');
  if (/insufficient permissions|PERMISSION_DENIED/i.test(m)) {
    return 'Ingen adgang (kun værten kan redigere — tjek Firestore-regler).';
  }
  return m;
}

function reducer(state, action) {
  switch (action.type) {
    case 'CREATE_SESSION':
      return createSession(state, action.name).state;
    case 'SELECT_SESSION':
      return selectSession(state, action.id);
    case 'RENAME_SESSION':
      return renameSession(state, action.id, action.name);
    case 'DELETE_SESSION':
      return deleteSession(state, action.id);
    case 'ADD_HAND':
      return addHand(state, state.activeSessionId, action.hand);
    case 'DELETE_HAND':
      return deleteHand(state, state.activeSessionId, action.handId);
    case 'UNDO_LAST':
      return undoLastHand(state, state.activeSessionId);
    case 'CLEAR_SESSION':
      return clearSession(state, state.activeSessionId);
    case 'REPLACE':
      return action.state;
    default:
      return state;
  }
}

export function AppStateProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadAppState);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const firstRun = useRef(true);

  // Shared-mode state.
  const [roomCode, setRoomCode] = useState(null);
  const [sharedData, setSharedData] = useState(null);
  const [myUid, setMyUid] = useState(null);
  const [sharedStatus, setSharedStatus] = useState('idle'); // idle|connecting|connected|syncing|offline|error
  const [sharedError, setSharedError] = useState(null);
  const [resumeRoom, setResumeRoom] = useState(null); // { roomCode, sessionName } | null

  const firebaseReady = isFirebaseConfigured();
  const isShared = !!roomCode;
  const mode = !isShared
    ? 'local'
    : sharedData && myUid && sharedData.hostUid === myUid
    ? 'shared-host'
    : 'shared-viewer';
  const canEdit = mode === 'local' || mode === 'shared-host';

  // Persist LOCAL state on every change (only writer of localStorage).
  useEffect(() => {
    const res = saveAppState(state);
    if (res.ok) {
      setSaveError(null);
      if (!firstRun.current) setLastSavedAt(new Date());
    } else {
      setSaveError('Kunne ikke gemme lokalt (privat browsing eller fuld lagring?).');
    }
    firstRun.current = false;
  }, [state]);

  // Live-subscribe to the shared game whenever a room is active.
  useEffect(() => {
    if (!roomCode) {
      setSharedData(null);
      setSharedStatus('idle');
      return undefined;
    }
    let active = true;
    let unsub = () => {};
    setSharedStatus('connecting');
    loadShared()
      .then((m) => {
        if (!active) return;
        unsub = m.subscribeToSharedGame(roomCode, (evt) => {
          if (!active) return;
          if (evt.error) {
            setSharedError(errMsg(evt.error));
            setSharedStatus('error');
            return;
          }
          if (!evt.exists) {
            setSharedData(null);
            setSharedError('Delt spil findes ikke længere.');
            setSharedStatus('error');
            return;
          }
          setSharedData(evt.data);
          setSharedError(null);
          setSharedStatus(evt.hasPendingWrites ? 'syncing' : evt.fromCache ? 'offline' : 'connected');
          if (evt.data && evt.data.sessionName) updateRecentRoomName(roomCode, evt.data.sessionName);
        });
      })
      .catch((e) => {
        if (active) {
          setSharedError(errMsg(e));
          setSharedStatus('error');
        }
      });
    return () => {
      active = false;
      unsub();
    };
  }, [roomCode]);

  const updateUrlRoom = useCallback((code) => {
    const url = new URL(window.location.href);
    if (code) url.searchParams.set('room', code);
    else url.searchParams.delete('room');
    window.history.replaceState({}, '', url);
  }, []);

  // Shared lifecycle actions.
  const startSharedGame = useCallback(async () => {
    setSharedError(null);
    setSharedStatus('connecting');
    try {
      const m = await loadShared();
      const localSession = getActiveSession(state);
      const { roomCode: code, hostUid } = await m.createSharedGameFromSession(localSession);
      setMyUid(hostUid);
      setRoomCode(code);
      updateUrlRoom(code);
      recordSharedRoom({ roomCode: code, sessionName: localSession ? localSession.name : '' });
      setResumeRoom(null);
      return { ok: true, roomCode: code };
    } catch (e) {
      const msg = errMsg(e);
      setSharedError(msg);
      setSharedStatus('error');
      return { ok: false, error: msg };
    }
  }, [state, updateUrlRoom]);

  const joinShared = useCallback(
    async (input) => {
      const code = normalizeRoomCode(input);
      if (!isValidRoomCode(code)) return { ok: false, error: 'Ugyldig kode (mindst 4 tegn).' };
      setSharedError(null);
      setSharedStatus('connecting');
      try {
        const m = await loadShared();
        const res = await m.joinSharedGame(code);
        setMyUid(res.uid);
        setRoomCode(code);
        updateUrlRoom(code);
        recordSharedRoom({ roomCode: code, sessionName: res.data ? res.data.sessionName : '' });
        setResumeRoom(null);
        return { ok: true, isHost: res.isHost };
      } catch (e) {
        const msg = errMsg(e);
        setSharedError(msg);
        setSharedStatus('error');
        return { ok: false, error: msg };
      }
    },
    [updateUrlRoom],
  );

  const leaveShared = useCallback(() => {
    setRoomCode(null);
    setSharedData(null);
    setMyUid(null);
    setSharedStatus('idle');
    setSharedError(null);
    setResumeRoom(null);
    clearLastSharedRoom(); // don't nag to resume a room you explicitly left
    updateUrlRoom(null);
  }, [updateUrlRoom]);

  // Resume banner: continue the remembered room, or stay local (and forget it).
  const resumeShared = useCallback(() => {
    const code = resumeRoom && resumeRoom.roomCode;
    setResumeRoom(null);
    if (code) return joinShared(code);
    return Promise.resolve({ ok: false });
  }, [resumeRoom, joinShared]);

  const stayLocal = useCallback(() => {
    clearLastSharedRoom();
    setResumeRoom(null);
  }, []);

  // Mode-aware editing actions. In shared-viewer mode these are no-ops (the UI
  // also hides the controls).
  const doAddHand = useCallback(
    async (hand) => {
      if (mode === 'shared-host') {
        const m = await loadShared();
        await m.addSharedHand(roomCode, hand);
      } else if (mode === 'local') {
        dispatch({ type: 'ADD_HAND', hand });
      }
    },
    [mode, roomCode],
  );
  const doUndoLast = useCallback(async () => {
    if (mode === 'shared-host') {
      const m = await loadShared();
      await m.undoSharedHand(roomCode);
    } else if (mode === 'local') {
      dispatch({ type: 'UNDO_LAST' });
    }
  }, [mode, roomCode]);
  const doClear = useCallback(async () => {
    if (mode === 'shared-host') {
      const m = await loadShared();
      await m.clearSharedGame(roomCode);
    } else if (mode === 'local') {
      dispatch({ type: 'CLEAR_SESSION' });
    }
  }, [mode, roomCode]);
  const doDeleteHand = useCallback(
    async (handId) => {
      if (mode === 'shared-host') {
        const m = await loadShared();
        await m.deleteSharedHand(roomCode, handId);
      } else if (mode === 'local') {
        dispatch({ type: 'DELETE_HAND', handId });
      }
    },
    [mode, roomCode],
  );

  // Host-only: archive the current evening and start a new one (shared mode).
  const doArchive = useCallback(async () => {
    if (mode !== 'shared-host') return { ok: false, error: 'Kun værten kan arkivere.' };
    try {
      const m = await loadShared();
      await m.archiveSharedSession(roomCode);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: errMsg(e) };
    }
  }, [mode, roomCode]);

  // Host-only: delete one archived evening from Samlet historik.
  const doDeleteArchived = useCallback(
    async (archiveId) => {
      if (mode !== 'shared-host') return { ok: false, error: 'Kun værten kan slette arkiverede aftener.' };
      try {
        const m = await loadShared();
        await m.deleteArchivedSession(roomCode, archiveId);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: errMsg(e) };
      }
    },
    [mode, roomCode],
  );

  // On first load: ?room=CODE auto-joins; otherwise offer to resume the last room.
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    if (!isFirebaseConfigured()) return;
    const code = new URLSearchParams(window.location.search).get('room');
    if (code) {
      joinShared(code);
      return;
    }
    const last = getLastSharedRoomCode();
    if (last) {
      const match = getRecentSharedRooms().find((r) => r.roomCode === last);
      setResumeRoom({ roomCode: last, sessionName: match ? match.sessionName : '' });
    }
  }, [joinShared]);

  const activeSession = useMemo(
    () => (isShared ? mapSharedDocToSession(sharedData) : getActiveSession(state)),
    [isShared, sharedData, state],
  );
  const totals = useMemo(
    () => computeTotals(activeSession ? activeSession.hands : []),
    [activeSession],
  );
  const shareLink = isShared && roomCode ? buildShareLink(roomCode) : null;

  // Long-term archive + cumulative score (shared mode only).
  const archivedSessions = useMemo(
    () => (isShared ? getArchivedSessions(sharedData) : []),
    [isShared, sharedData],
  );
  const cumulativeTotals = useMemo(
    () => (isShared ? computeCumulativeTotals(sharedData) : totals),
    [isShared, sharedData, totals],
  );
  // Long-term medal standings (shared mode) and provisional "Står til" medal for
  // the current active evening (shown on the live scoreboard in any mode).
  const medalStandings = useMemo(
    () => (isShared ? buildMedalStandings(archivedSessions, activeSession ? activeSession.hands : []) : null),
    [isShared, archivedSessions, activeSession],
  );
  const provisionalMedals = useMemo(
    () => (activeSession && activeSession.hands.length ? computeMedalsForTotals(totals) : null),
    [activeSession, totals],
  );

  const actions = useMemo(
    () => ({
      // editing (mode-aware)
      addHand: doAddHand,
      undoLast: doUndoLast,
      clearSession: doClear,
      deleteHand: doDeleteHand,
      archiveSession: doArchive,
      deleteArchived: doDeleteArchived,
      resumeShared,
      stayLocal,
      // local-only session management
      createSession: (name) => dispatch({ type: 'CREATE_SESSION', name }),
      selectSession: (id) => dispatch({ type: 'SELECT_SESSION', id }),
      renameSession: (id, name) => dispatch({ type: 'RENAME_SESSION', id, name }),
      deleteSession: (id) => dispatch({ type: 'DELETE_SESSION', id }),
      importBackup: (text) => {
        const res = importAppState(state, text);
        if (res.ok) dispatch({ type: 'REPLACE', state: res.state });
        return res;
      },
      exportBackup: () => exportAppState(state),
      // shared lifecycle
      startSharedGame,
      joinShared,
      leaveShared,
    }),
    [
      state,
      doAddHand,
      doUndoLast,
      doClear,
      doDeleteHand,
      doArchive,
      doDeleteArchived,
      startSharedGame,
      joinShared,
      leaveShared,
      resumeShared,
      stayLocal,
    ],
  );

  const value = {
    state,
    activeSession,
    totals,
    lastSavedAt,
    saveError,
    // shared mode
    firebaseReady,
    isShared,
    mode,
    canEdit,
    roomCode,
    sharedStatus,
    sharedError,
    shareLink,
    archivedSessions,
    cumulativeTotals,
    medalStandings,
    provisionalMedals,
    resumeRoom,
    actions,
  };
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}
