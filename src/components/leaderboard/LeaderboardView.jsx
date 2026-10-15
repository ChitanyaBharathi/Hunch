import { useState } from 'react';
import { useGame } from '../../context/GameContext';
export const money = value => `S$${Number(value).toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export function RoundTable({ rows, selfId }) {
  return <div className="table-scroll"><table className="ranking-table"><thead><tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col">Guess</th><th scope="col">Distance</th></tr></thead><tbody>{rows.map(row => <tr key={row.playerId} className={`${row.rank === 1 ? 'winner-row' : ''} ${row.playerId === selfId ? 'self-row' : ''}`}><td>{String(row.rank).padStart(2, '0')}</td><th scope="row">{row.name}{row.playerId === selfId && <small>YOU</small>}</th><td>{money(row.guess)}</td><td>{row.difference === 0 ? 'Exact!' : `${money(row.difference)} off`}</td></tr>)}</tbody></table></div>;
}
export function LeaderboardView({ initialTab = 'round' }) {
  const { room } = useGame();
  const [tab, setTab] = useState(initialTab);
  const [selectedRound, setSelectedRound] = useState(null);
  const previous = room.history.find(r => r.roundIndex === selectedRound);
  const rows = previous ? previous.rankings : room.rankings;
  return <section className="competition-view animate-slide-up"><p className="eyebrow">THE NUMBERS DON’T LIE</p><h1>Who’s <em>closest?</em></h1><p className="caption">Round rankings use the absolute difference from the actual price. Over and under count equally; equal distances tie.</p>
    <div className="segmented-tabs"><button className={`tab-btn ${tab === 'round' ? 'active' : ''}`} onClick={() => setTab('round')}>By round</button><button className={`tab-btn ${tab === 'overall' ? 'active' : ''}`} onClick={() => setTab('overall')}>Overall points</button></div>
    {tab === 'round' ? <><label className="round-select-label" htmlFor="round-select">Choose a round</label><select id="round-select" value={selectedRound ?? 'current'} onChange={e => setSelectedRound(e.target.value === 'current' ? null : Number(e.target.value))}><option value="current">Current round — {room.product.title}</option>{room.history.filter(r => r.roundIndex !== room.roundIndex).map(r => <option key={r.roundIndex} value={r.roundIndex}>Round {r.roundIndex + 1} — {r.title}</option>)}</select>{rows.length ? <RoundTable rows={rows} selfId={room.selfId} /> : <div className="empty-state"><h2>The suspense is part of it.</h2><p>Rankings appear when the host reveals the price. {room.submittedCount} of {room.players.length} guesses are locked in.</p></div>}</> : <><p className="caption">Up to 100 points per revealed round, based on price accuracy. Missed rounds earn 0 points.</p><div className="table-scroll"><table className="ranking-table"><thead><tr><th>Rank</th><th>Player</th><th>Points</th><th>Wins</th></tr></thead><tbody>{room.overall.map(row => <tr key={row.playerId} className={row.playerId === room.selfId ? 'self-row' : ''}><td>{row.rank}</td><th scope="row">{row.name}</th><td>{row.points}</td><td>{row.wins}</td></tr>)}</tbody></table></div></>}
  </section>;
}
