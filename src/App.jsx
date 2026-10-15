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

if (new URLSearchParams(window.location.search).get('portal') === 'company') window.location.replace('/insights');

function MainApp() {
  const [activeTab, setActiveTab] = useState('play');
  const { room, session, connected, error } = useGame();

  return (
    <div className="app-container">
      <Header currentTab={activeTab} onNavigate={(tab) => setActiveTab(tab)} />

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
