import { money } from '../leaderboard/LeaderboardView';

// Everyone's guess on a log scale around the real price, so "double" and "half" sit equally far away.
export function RevealStrip({ rankings, actual, selfId }) {
  if (!rankings.length || !actual) return null;
  const ratios = rankings.map(r => Math.log(r.guess / actual));
  const span = Math.max(0.3, ...ratios.map(Math.abs)) * 1.15;
  const pos = r => 50 + (r / span) * 46;
  const over = rankings.filter(r => r.guess > actual).length;
  const under = rankings.filter(r => r.guess < actual).length;
  const sorted = [...rankings.map(r => r.guess)].sort((a, b) => a - b);
  const mid = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  const crowdOff = Math.abs(mid - actual);
  const beaten = rankings.filter(r => r.difference > crowdOff).length;
  return <figure className="reveal-strip" aria-label={`${under} guessed under, ${over} guessed over the real price of ${money(actual)}`}>
    <div className="reveal-track">
      <span className="reveal-zone-label left">cheaper</span><span className="reveal-zone-label right">pricier</span>
      <span className="reveal-actual" style={{ left: '50%' }} />
      {rankings.map((r, i) => <span key={r.playerId} className={`reveal-dot ${r.playerId === selfId ? 'self' : ''}`}
        style={{ left: `${pos(ratios[i])}%`, animationDelay: `${120 + i * 70}ms` }} title={`${r.name}: ${money(r.guess)}`}>
        {r.playerId === selfId && <em>you</em>}</span>)}
    </div>
    <figcaption>
      {rankings.length > 1
        ? <>{under} under · {over} over. The room’s middle guess was <strong>{money(mid)}</strong>{beaten > 0 && <> and beat {beaten} of {rankings.length} players</>}.</>
        : <>{rankings[0].difference === 0 ? 'Bang on.' : `${Math.round((rankings[0].guess / actual - 1) * 100)}% ${rankings[0].guess > actual ? 'over' : 'under'}.`}</>}
    </figcaption>
  </figure>;
}
