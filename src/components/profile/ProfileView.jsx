import { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { useTheme } from '../../context/ThemeContext';
import { money } from '../leaderboard/LeaderboardView';
import { GuessAccuracy } from '../common/GuessAccuracy';
export function ProfileView() {
  const { room, leaveRoom, act, busy } = useGame();
  const { theme, toggleTheme } = useTheme();
  const [confirm, setConfirm] = useState(false);
  const stats = room.overall.find(p => p.playerId === room.selfId);
  const history = room.history.flatMap(r => r.rankings.filter(p => p.playerId === room.selfId).map(p => ({ ...p, title: r.title, round: r.roundIndex + 1 })));
  return <section className="competition-view animate-slide-up"><p className="eyebrow">YOUR PRICE INSTINCT</p><h1>{stats.name}<em>.</em></h1><p className="caption">Room {room.code} · {room.isHost ? 'Host' : 'Player'}</p><div className="hero-stats profile-game-stats"><div><strong>{stats.points}</strong><span>points</span></div><GuessAccuracy stats={stats} /><div><strong>{stats.wins}</strong><span>round wins</span></div></div><h2>Your guesses</h2>
    {history.length ? <div className="table-scroll"><table className="ranking-table"><thead><tr><th>Round / item</th><th>Your guess</th><th>Distance</th></tr></thead><tbody>{history.map(row => <tr key={row.round}><th scope="row">{row.round}. {row.title}</th><td>{money(row.guess)}</td><td>{money(row.difference)} off</td></tr>)}</tbody></table></div> : <p className="empty-state">Your guesses appear here after each price reveal.</p>}
    <button className="btn-secondary" onClick={toggleTheme}>Switch to {theme === 'light' ? 'dark' : 'light'} mode</button>
    <p className="caption">Your name, guesses and scores are visible to this room. This browser remembers your player session.</p>
    <label className="research-optin"><input type="checkbox" checked={room.researchConsent} disabled={busy} onChange={e => act('consent', { researchConsent: e.target.checked })} /><span><strong>Contribute to commercial pricing research</strong><small>Optional. Include future guesses and optional maximum-pay answers in aggregate reports that may be sold to companies. Turning this off removes your contributions from future reports for this room. It does not recall previously downloaded reports. Opting in now does not add earlier guesses.</small></span></label>
    {confirm ? <div className="leave-confirm"><p>{room.isHost && !room.finished ? 'You are the host. Leave only after finishing the game; this browser holds your host controls.' : 'Leave this room? Your submitted guesses remain on its leaderboard.'}</p><button className="btn-secondary" onClick={() => { leaveRoom(); window.history.replaceState({}, '', window.location.pathname); }}>Leave room</button><button className="btn-ghost" onClick={() => setConfirm(false)}>Stay in game</button></div> : <button className="btn-ghost" onClick={() => setConfirm(true)}>{room.finished ? 'Leave and start a new game' : 'Leave room'}</button>}
  </section>;
}
