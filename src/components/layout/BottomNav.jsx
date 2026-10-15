import React from 'react';
import { PlayCircle, Trophy, User, ChartColumn } from 'lucide-react';
import { useGame } from '../../context/GameContext';

export function BottomNav({ activeTab, onSelectTab }) {
  const { room } = useGame();
  const navItems = [
    { id: 'play', label: 'Play', icon: PlayCircle },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
    { id: 'profile', label: 'Profile', icon: User },
    ...(room.isHost ? [{ id: 'insights', label: 'Insights', icon: ChartColumn }] : [])
  ];

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => onSelectTab(item.id)}
            aria-label={item.label}
          >
            <div className="nav-icon-wrap">
              <Icon size={22} strokeWidth={isActive ? 2.3 : 1.8} />
            </div>
            <span className="nav-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
