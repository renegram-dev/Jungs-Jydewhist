// Single source of truth for the whole app. Loads from localStorage once,
// then persists on EVERY state change (the only saveAppState call site). All
// mutations go through storage.js pure transforms via the reducer.

import React, { createContext, useContext, useReducer, useEffect, useMemo, useRef, useState } from 'react';
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

const AppStateContext = createContext(null);

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

  // Persist on every change. The first run (mount) writes through but does not
  // claim a fresh "saved" time, so the indicator only lights up on real edits.
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

  const activeSession = getActiveSession(state);
  const totals = useMemo(
    () => computeTotals(activeSession ? activeSession.hands : []),
    [activeSession],
  );

  const actions = useMemo(
    () => ({
      createSession: (name) => dispatch({ type: 'CREATE_SESSION', name }),
      selectSession: (id) => dispatch({ type: 'SELECT_SESSION', id }),
      renameSession: (id, name) => dispatch({ type: 'RENAME_SESSION', id, name }),
      deleteSession: (id) => dispatch({ type: 'DELETE_SESSION', id }),
      addHand: (hand) => dispatch({ type: 'ADD_HAND', hand }),
      deleteHand: (handId) => dispatch({ type: 'DELETE_HAND', handId }),
      undoLast: () => dispatch({ type: 'UNDO_LAST' }),
      clearSession: () => dispatch({ type: 'CLEAR_SESSION' }),
      // Import returns a result so the UI can show success/error; only commits on ok.
      importBackup: (text) => {
        const res = importAppState(state, text);
        if (res.ok) dispatch({ type: 'REPLACE', state: res.state });
        return res;
      },
      exportBackup: () => exportAppState(state),
    }),
    [state],
  );

  const value = { state, activeSession, totals, lastSavedAt, saveError, actions };
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}
