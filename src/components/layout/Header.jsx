import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useGame } from '../../context/GameContext';

export function Header({ currentTab, onNavigate }) {
  const { theme, toggleTheme } = useTheme();
  const { room } = useGame();
  const player = room?.players.find(p => p.id === room.selfId);

  return (
    <header className="app-header">
      <button className="header-brand" onClick={() => onNavigate('play')} aria-label="Hunch home">
        <span className="brand-mark" aria-hidden="true">H</span>
        <span className="brand-name">Hunch<em>.</em></span>
      </button>
      <nav className="desktop-nav" aria-label="Main navigation">
        {room && ['play', 'leaderboard', 'profile', ...(room.isHost ? ['insights'] : [])].map(tab => <button key={tab} className={currentTab === tab ? 'active' : ''} onClick={() => onNavigate(tab)} aria-current={currentTab === tab ? 'page' : undefined}>{tab === 'play' ? 'Play' : tab === 'leaderboard' ? 'Leaderboard' : tab === 'insights' ? 'Insights' : 'Profile'}</button>)}
      </nav>

      <div className="header-actions">

        <button
          onClick={toggleTheme}
          className="header-icon-btn"
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        {player && <button
          onClick={() => onNavigate('profile')}
          className={`header-avatar-btn ${currentTab === 'profile' ? 'active' : ''}`}
          aria-label="View Profile"
          title="Profile"
        >
          <div className="avatar-circle">
            {player.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
          </div>
        </button>}
      </div>
    </header>
  );
}
