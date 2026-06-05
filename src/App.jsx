import React, { useState } from 'react';
import Scoreboard from './components/Scoreboard.jsx';
import NewHandForm from './components/NewHandForm.jsx';
import SessionManager from './components/SessionManager.jsx';

export default function App() {
  const [screen, setScreen] = useState('scoreboard'); // 'scoreboard' | 'newhand'
  const [sessionsOpen, setSessionsOpen] = useState(false);

  return (
    <div className="app">
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
