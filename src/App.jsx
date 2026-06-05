import React, { useEffect, useState } from 'react';
import Scoreboard from './components/Scoreboard.jsx';
import NewHandForm from './components/NewHandForm.jsx';
import SessionManager from './components/SessionManager.jsx';
import UpdateBanner from './components/UpdateBanner.jsx';
import { isUpdateAvailable } from './lib/updateCheck.js';

export default function App() {
  const [screen, setScreen] = useState('scoreboard'); // 'scoreboard' | 'newhand'
  const [sessionsOpen, setSessionsOpen] = useState(false);
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

  return (
    <div className="app">
      {updateReady && <UpdateBanner onReload={() => window.location.reload()} />}

      {screen === 'scoreboard' && (
        <Scoreboard
          onNewHand={() => setScreen('newhand')}
          onOpenSessions={() => setSessionsOpen(true)}
        />
      )}
      {screen === 'newhand' && <NewHandForm onDone={() => setScreen('scoreboard')} />}
      {sessionsOpen && <SessionManager onClose={() => setSessionsOpen(false)} />}
    </div>
  );
}
