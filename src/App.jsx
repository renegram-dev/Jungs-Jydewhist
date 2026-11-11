import React, { useEffect, useState } from 'react';
import Scoreboard from './components/Scoreboard.jsx';
import NewHandForm from './components/NewHandForm.jsx';
import UpdateBanner from './components/UpdateBanner.jsx';
import { Splash, LoginScreen, ErrorScreen, MissingHistory, ConnectionOverlay } from './components/HistoryGate.jsx';
import { useAppState } from './state/AppStateContext.jsx';
import { isUpdateAvailable } from './lib/updateCheck.js';

export default function App() {
  const { status, activeSession } = useAppState();
  const [screen, setScreen] = useState('scoreboard'); // 'scoreboard' | 'newhand'
  const [updateReady, setUpdateReady] = useState(false);

  // Check for a newer deployed build on startup and whenever the app returns to
  // the foreground (covers the iPhone home-screen app resuming from background).
  // Production only — dev has no built version.json.
  useEffect(() => {
    if (!import.meta.env.PROD) return undefined;
    let cancelled = false;
    const check = () => {
      isUpdateAvailable().then((yes) => {
        if (!cancelled && yes) setUpdateReady(true);
      });
    };
    check();
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Gate: scores are only ever rendered from a server-confirmed cloud document.
  let body;
  if (status === 'auth-loading') body = <Splash text="Indlæser…" />;
  else if (status === 'signed-out') body = <LoginScreen />;
  else if (status === 'loading') body = <Splash text="Henter historik fra skyen…" />;
  else if (status === 'missing') body = <MissingHistory />;
  else if (status === 'error') body = <ErrorScreen />;
  else if (!activeSession) body = <ConnectionOverlay />; // offline before any data
  else {
    body = (
      <>
        {screen === 'scoreboard' && <Scoreboard onNewHand={() => setScreen('newhand')} />}
        {screen === 'newhand' && <NewHandForm onDone={() => setScreen('scoreboard')} />}
        {status === 'offline' && <ConnectionOverlay />}
      </>
    );
  }

  return (
    <div className="app">
      {updateReady && <UpdateBanner onReload={() => window.location.reload()} />}
      {body}
    </div>
  );
}
