import React, { useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { GameProvider, useGame } from './context/GameContext';
import { Header } from './components/layout/Header';
import { BottomNav } from './components/layout/BottomNav';
import { PlayView } from './components/play/PlayView';
import { LeaderboardView } from './components/leaderboard/LeaderboardView';
import { ProfileView } from './components/profile/ProfileView';
import { HomeScreen } from './components/onboarding/HomeScreen';
import { PricingInsights } from './components/b2b/PricingInsights';
import { Modal } from './components/layout/Modal';

if (new URLSearchParams(window.location.search).get('portal') === 'company') window.location.replace('/insights');

function MainApp() {
  const [activeTab, setActiveTab] = useState('play');
  const { room, session, connected, error, busy, leaveRoom, endRoom } = useGame();
  const [confirmExit, setConfirmExit] = useState(false);
  // A host leaving a party game ends it for everyone; anyone else just drops out.
  const endsForAll = Boolean(room?.isHost && room.mode !== 'daily' && !room.finished);
  const leave = async () => {
    if (endsForAll && !(await endRoom())) { setConfirmExit(false); return; } // Couldn't reach the server: stay, and the error shows.
    setConfirmExit(false);
    if (!endsForAll) leaveRoom();
    window.history.replaceState({}, '', window.location.pathname);
    setActiveTab('play');
  };
  const exitGame = () => (room && !room.finished ? setConfirmExit(true) : leave());

  return (
    <div className="app-container">
      <Header currentTab={activeTab} onNavigate={(tab) => setActiveTab(tab)} onExit={exitGame} />

      <main className="main-content">
        {!session ? <HomeScreen /> : !room ? <div className="empty-state" role="status">{connected ? 'Loading your room...' : 'Connecting to your game... Keep the host’s server running.'}</div> : <>
          {!connected && <p className="connection-warning" role="status">Connection lost. Reconnecting to the game...</p>}
          {error && <p className="action-error" role="alert">{error}</p>}
          {activeTab === 'play' && <PlayView key={`${room.code}:${room.roundIndex}`} onOpenLeaderboard={() => setActiveTab('leaderboard')} />}
          {activeTab === 'leaderboard' && <LeaderboardView initialTab="overall" />}
          {activeTab === 'profile' && <ProfileView />}
          {activeTab === 'insights' && room.isHost && <PricingInsights />}
        </>}
      </main>

      <Modal isOpen={confirmExit} onClose={() => setConfirmExit(false)} title={endsForAll ? 'End this game for everyone?' : 'Leave this game?'}>
        <p className="exit-confirm-text">{endsForAll
          ? 'You’re the host, so leaving ends the game for every player. Everyone goes back to the home page. Results from rounds already revealed stay saved.'
          : 'You’ll go back to the home page. Your guesses so far stay saved, but you’ll drop out of this room.'}</p>
        <div className="exit-confirm-actions">
          <button className="btn-secondary" onClick={() => setConfirmExit(false)}>Keep playing</button>
          <button className="btn-primary" onClick={leave} disabled={busy}><span>{endsForAll ? 'End game' : 'Leave game'}</span></button>
        </div>
      </Modal>

      {room && <BottomNav activeTab={activeTab} onSelectTab={(tab) => setActiveTab(tab)} />}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <GameProvider>
        <MainApp />
      </GameProvider>
    </ThemeProvider>
  );
}
