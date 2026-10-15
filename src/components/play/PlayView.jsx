import { useState } from 'react';
import { ArrowRight, Check, Copy, Users } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { ItemCard } from './ItemCard';
import { GuessAccuracy } from '../common/GuessAccuracy';
import { RoundTable, money } from '../leaderboard/LeaderboardView';
import { RevealStrip } from './RevealStrip';
import { PriceStyleCard, DailyShare } from './EndCards';

export function PlayView({ onOpenLeaderboard }) {
  const { room, busy, act, leaveRoom } = useGame();
  const [value, setValue] = useState('');
  const [maximumPay, setMaximumPay] = useState('');
  const [tooCheap, setTooCheap] = useState('');
  const [copied, setCopied] = useState(false);
  const [invite, setInvite] = useState('');
  const [earlyReveal, setEarlyReveal] = useState(false);
  const player = room.players.find(p => p.id === room.selfId);
  const stats = room.overall.find(p => p.playerId === room.selfId);
  const winners = room.rankings.filter(p => p.rank === 1);
  const allSubmitted = room.submittedCount === room.players.length;
  const daily = room.mode === 'daily';
  // Research questions on every third round only: fewer questions, answered properly.
  const askValue = room.researchConsent && room.roundIndex % 3 === 0;
  const copyInvite = async () => {
    const url = new URL(window.location.href); url.search = ''; url.searchParams.set('room', room.code);
    if (['localhost', '127.0.0.1'].includes(url.hostname)) {
      try { const response = await fetch('/api/network'); const { hosts } = await response.json(); if (hosts?.length) url.hostname = hosts[0]; } catch { /* Room code remains available if network lookup fails. */ }
    }
    setInvite(url.href);
    try { await navigator.clipboard.writeText(url.href); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setCopied(false); }
  };
  return <div className="play-view animate-slide-up">
    <section className="game-hero"><div><h1>{room.finished ? <>That’s a <em>wrap.</em></> : daily ? <>Today’s<br /><em>five.</em></> : <>How good is your<br />price instinct?</>}</h1><p>{room.finished ? (daily ? 'Come back tomorrow for five new items.' : 'The final scores are in. Bragging rights are yours to claim.') : daily ? 'Same items for everyone today. Get as close as you can.' : 'Guess the price. Get closer. Beat your friends.'}</p></div><div className="hero-stats"><div><strong>{stats.points}</strong><span>points</span><button type="button" className="rank-shortcut" onClick={onOpenLeaderboard}>Your rank: {room.history.length ? `#${stats.rank}` : '—'} <ArrowRight size={14} /><small>Leaderboard</small></button></div><GuessAccuracy stats={stats} /><div><strong>{stats.wins}</strong><span>round wins</span></div></div></section>
    {!daily && !room.lobby && <><div className="room-strip"><div><Users size={17} /><span>ROOM <strong>{room.code}</strong></span><span>{room.players.length} {room.players.length === 1 ? 'player' : 'players'}</span></div><button onClick={copyInvite} className="btn-ghost">{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? 'Link copied' : 'Copy invite link'}</button></div>
    {invite && <div className="invite-link"><label htmlFor="invite-url">Share this link with friends on the same Wi-Fi</label><input id="invite-url" readOnly value={invite} onFocus={e => e.target.select()} /></div>}</>}
    {room.lobby ? <div className="lobby">
      <section className="lobby-code"><p className="eyebrow">ROOM CODE</p><strong>{room.code}</strong><p>Friends open Hunch, tap <b>Join with a code</b> and type this in. Or send them the link.</p>
        <button onClick={copyInvite} className="btn-secondary">{copied ? <Check size={18} /> : <Copy size={18} />}{copied ? 'Link copied' : 'Copy invite link'}</button>
        {invite && <input aria-label="Invite link" className="lobby-invite" readOnly value={invite} onFocus={e => e.target.select()} />}</section>
      <section className="lobby-players"><p className="eyebrow">IN THE ROOM · {room.players.length}</p><ul>{room.players.map(p => <li key={p.id} className={p.id === room.hostId ? 'host' : ''}>{p.name}</li>)}</ul>
        {room.isHost ? <><button className="btn-primary" disabled={busy} onClick={() => act('start')}><span>{room.players.length === 1 ? 'Start solo' : `Start with ${room.players.length} players`}</span><ArrowRight size={24} /></button><p className="caption">{room.totalRounds} items. You reveal each price once everyone has guessed.</p></>
          : <p className="waiting-note">Waiting for the host to start. New players appear here as they join.</p>}</section>
    </div> : room.finished && daily ? <div className="end-cards"><DailyShare room={room} /><PriceStyleCard style={room.priceStyle} /></div> : room.finished ? <><PriceStyleCard style={room.priceStyle} /><section className="final-results"><p className="eyebrow">THE WINNER’S CIRCLE</p><h2>{room.overall.filter(p => p.rank === 1).map(p => p.name).join(' & ')} {room.overall.filter(p => p.rank === 1).length > 1 ? 'tie for first!' : 'takes the win!'}</h2><p>Check the leaderboard for every round’s closest guess.</p><table className="ranking-table"><thead><tr><th>Rank</th><th>Player</th><th>Points</th></tr></thead><tbody>{room.overall.map(p => <tr key={p.playerId}><td>{p.rank}</td><th scope="row">{p.name}</th><td>{p.points}</td></tr>)}</tbody></table></section></> : <>
    <div className="play-card-container"><ItemCard key={room.product.id} product={room.product} /><div className="guess-panel" key={room.roundIndex}>
      <div className="round-display"><span className="eyebrow">ROUND</span><div><strong>{String(room.roundIndex + 1).padStart(2, '0')}</strong><span>/ {room.totalRounds}</span></div></div>
      {room.revealed ? <div className="round-reveal" aria-live="polite"><p className="eyebrow">{room.product.benchmarkStatus === 'demo' ? 'DEMO BENCHMARK' : 'ACTUAL PRICE'}</p><h2>{money(room.actualPrice)}</h2>{!daily && <><p className="winner-announcement">{winners.map(p => p.name).join(' & ')} {winners.length > 1 ? 'tie for closest!' : 'is closest!'}</p><p className="caption">{winners[0].difference === 0 ? 'An exact match.' : `Just ${money(winners[0].difference)} away.`}</p></>}<RevealStrip rankings={room.rankings} actual={room.actualPrice} selfId={room.selfId} />{room.myGuess !== null && <p className="personal-result">Your guess: <strong>{money(room.myGuess)}</strong></p>}
        {room.isHost ? <button className="btn-primary" disabled={busy} onClick={async () => { if (await act('next')) { setValue(''); setEarlyReveal(false); } }}><span>{room.roundIndex === room.totalRounds - 1 ? 'Show final scores' : 'Next item'}</span><ArrowRight size={24} /></button> : <p className="waiting-note">Waiting for the host to start the next round.</p>}</div> : <>
      <h2>What’s the price?</h2><p className="playing-as">Playing as <strong>{player.name}</strong>{room.isHost && ' · Host'}</p>
      {room.myGuess !== null ? <div className="guess-locked" role="status"><Check size={24} /><div><strong>{money(room.myGuess)} locked in.</strong><p>Your guess stays secret until the reveal.</p></div></div> : <form onSubmit={async e => { e.preventDefault(); if (await act('guess', { guess: Number(value), maximumPay: askValue ? Number(maximumPay) : null, tooCheap: askValue ? Number(tooCheap) : null })) { setMaximumPay(''); setTooCheap(''); } }}><label className="input-label" htmlFor="competition-guess">Your guess</label><div className="price-input-wrapper"><span className="currency-prefix">S$</span><input id="competition-guess" className="price-field" type="number" inputMode="decimal" min="0.01" max="1000000" step="0.01" placeholder="0.00" value={value} onChange={e => setValue(e.target.value)} required disabled={busy} /></div>
      {askValue && <fieldset className="budget-question"><legend>Two quick research questions <span>(this round only)</span></legend>
        <label htmlFor="maximum-pay">What’s the most you’d personally pay for this?</label><input id="maximum-pay" type="number" inputMode="decimal" min="0" max="1000000" step="0.01" placeholder="S$ — enter 0 if you wouldn’t buy it" value={maximumPay} onChange={e => setMaximumPay(e.target.value)} required disabled={busy} />
        <label htmlFor="too-cheap">Below what price would it seem too cheap to trust?</label><input id="too-cheap" type="number" inputMode="decimal" min="0" max="1000000" step="0.01" placeholder="S$" value={tooCheap} onChange={e => setTooCheap(e.target.value)} required disabled={busy} />
        <p className="caption">Separate from your guess, and they don’t affect your score.</p></fieldset>}
      <button className="btn-primary" disabled={busy || !value || Number(value) <= 0}><span>{busy ? 'Locking in...' : 'Lock in guess'}</span><ArrowRight size={27} /></button><p className="caption scoring-caption">{daily ? 'The price shows as soon as you lock in.' : 'Closest guess wins. Above or below, both count.'}</p></form>}
      {!daily && <><div className="submission-status"><p><strong>{room.submittedCount} / {room.players.length}</strong> guesses locked in</p><div className="player-status-list">{room.players.map(p => <span key={p.id} className={p.submitted ? 'submitted' : ''}>{p.submitted ? <Check size={12} /> : <span className="status-dot" />}{p.name}</span>)}</div></div>
      {room.isHost ? <div className="host-controls">{earlyReveal && !allSubmitted && <p className="caption" role="alert">{room.players.length - room.submittedCount} players haven’t guessed. Reveal anyway?</p>}<button className="btn-secondary" disabled={busy || !room.submittedCount} onClick={() => { if (!allSubmitted && !earlyReveal) setEarlyReveal(true); else act('reveal'); }}>{earlyReveal && !allSubmitted ? 'Yes, reveal and close guesses' : 'Reveal the price'}</button>{earlyReveal && !allSubmitted && <button className="btn-ghost" onClick={() => setEarlyReveal(false)}>Keep waiting</button>}</div> : <p className="waiting-note">The host reveals the price after everyone guesses.</p>}</>}
      </>}
    </div></div>
    {room.revealed && !daily && <section className="round-results"><p className="eyebrow">ROUND {room.roundIndex + 1} RESULTS</p><h2>Closest takes it.</h2><RoundTable rows={room.rankings} selfId={room.selfId} /></section>}
    </>}
    {room.finished && <div className="game-exit"><button className="btn-primary" onClick={() => { leaveRoom(); window.history.replaceState({}, '', window.location.pathname); }}><span>Back to home</span><ArrowRight size={22} /></button></div>}
  </div>;
}
