import { useState } from 'react';
import { ArrowRight, BarChart3, CalendarDays, Users } from 'lucide-react';
import { useGame } from '../../context/GameContext';

const NAME_KEY = 'hunch_name';
const readName = () => { try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; } };
const cleanCode = value => value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

export function HomeScreen() {
  const { enterRoom, busy, error, clearError } = useGame();
  const invited = cleanCode(new URLSearchParams(window.location.search).get('room') || '');
  const [name, setName] = useState(readName);
  const [code, setCode] = useState(invited);
  const [joining, setJoining] = useState(Boolean(invited));
  const [researchConsent, setResearchConsent] = useState(false);
  const ready = name.trim().length > 0;

  const go = async (roomCode, mode) => {
    clearError();
    try { localStorage.setItem(NAME_KEY, name.trim()); } catch { /* name is a convenience */ }
    if (await enterRoom(name.trim(), roomCode, researchConsent, mode) && roomCode) window.history.replaceState({}, '', window.location.pathname);
  };

  return <section className="home animate-slide-up">
    <header className="home-intro">
      <p className="eyebrow">HUNCH · WHAT PEOPLE <em>THINK</em> THINGS COST</p>
      <h1>Who knows the <em>price?</em></h1>
      <p>Guess what everyday things cost. Closest wins.</p>
    </header>

    <div className="home-name">
      <label htmlFor="player-name">Your name</label>
      <input id="player-name" maxLength={30} autoComplete="nickname" placeholder="e.g. Chaitanya" value={name} onChange={e => setName(e.target.value)} disabled={busy} />
      <label className="research-optin">
        <input type="checkbox" checked={researchConsent} onChange={e => setResearchConsent(e.target.checked)} disabled={busy} />
        <span><strong>Count my guesses in pricing research</strong> <small>I’m 18 or older. Optional, and it doesn’t change the game.</small>
          <details><summary>What this means</summary><small>Your guesses and optional answers are used in aggregate pricing reports that may be sold to companies. Reports never include names or room codes. You can withdraw any time in Profile; reports already downloaded can’t be recalled.</small></details></span>
      </label>
    </div>

    {error && <p className="action-error" role="alert">{error}</p>}

    {invited && <p className="home-invite" role="status">You’ve been invited to room <strong>{invited}</strong>.</p>}

    <div className="home-choices">
      {!invited && <article className="home-card home-daily">
        <CalendarDays size={28} aria-hidden="true" />
        <h2>Today’s five</h2>
        <p>Solo, about a minute. Same five items for everyone today — share your score and keep a streak.</p>
        <button className="btn-primary" disabled={busy || !ready} onClick={() => go(undefined, 'daily')}><span>Play now</span><ArrowRight size={22} /></button>
      </article>}

      <article className="home-card home-friends">
        <Users size={28} aria-hidden="true" />
        <h2>Play with friends</h2>
        <p>Everyone guesses on their own phone. The host starts each round and reveals the price.</p>
        {joining
          ? <form className="home-join" onSubmit={e => { e.preventDefault(); go(code); }}>
              <label htmlFor="room-code">Room code</label>
              <input id="room-code" className="code-input" placeholder="ABC123" inputMode="text" autoCapitalize="characters" maxLength={6} value={code} onChange={e => setCode(cleanCode(e.target.value))} disabled={busy} autoFocus={!invited} />
              <button className="btn-primary" disabled={busy || !ready || code.length !== 6}><span>{busy ? 'Joining…' : 'Join room'}</span><ArrowRight size={22} /></button>
              {!invited && <button type="button" className="btn-ghost" onClick={() => setJoining(false)}>Back</button>}
            </form>
          : <div className="home-buttons">
              <button className="btn-primary" disabled={busy || !ready} onClick={() => go(undefined, 'party')}><span>Start a room</span><ArrowRight size={22} /></button>
              <button className="btn-secondary" disabled={busy} onClick={() => setJoining(true)}>Join with a code</button>
            </div>}
      </article>

      {!invited && <a className="home-card home-company" href="/insights">
        <BarChart3 size={28} aria-hidden="true" />
        <h2>For companies</h2>
        <p>See the research dashboard: what shoppers think your products cost, and what they’d pay.</p>
        <span className="home-link">Open Hunch Insights <ArrowRight size={18} /></span>
      </a>}
    </div>
    {!ready && <p className="caption home-hint">Enter your name to play.</p>}
  </section>;
}
