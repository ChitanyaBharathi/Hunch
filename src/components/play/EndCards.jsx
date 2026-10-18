import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';

// Coloured squares for the pasted share text; the page itself draws plain CSS tiles.
const level = accuracy => (accuracy >= 90 ? 'great' : accuracy >= 70 ? 'good' : accuracy >= 40 ? 'fair' : 'miss');
const tile = accuracy => (accuracy >= 90 ? '🟩' : accuracy >= 70 ? '🟨' : accuracy >= 40 ? '🟧' : '⬛');
const STREAK_KEY = 'hunch_daily_streak';

function readStreak() { try { return JSON.parse(localStorage.getItem(STREAK_KEY)) ?? {}; } catch { return {}; } }

// Records today's play once; the streak continues only if yesterday was played too.
function recordStreak(date) {
  const saved = readStreak();
  if (!date || saved.last === date) return saved;
  const yesterday = new Date(Date.parse(`${date}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
  const current = saved.last === yesterday ? (saved.current ?? 0) + 1 : 1;
  const next = { last: date, current, best: Math.max(current, saved.best ?? 0) };
  try { localStorage.setItem(STREAK_KEY, JSON.stringify(next)); } catch { /* streak is a convenience */ }
  return next;
}

export function PriceStyleCard({ style }) {
  if (!style) return null;
  const lean = style.biasPct === 0 ? 'right on average' : `${Math.abs(style.biasPct)}% ${style.biasPct > 0 ? 'high' : 'low'} on average`;
  return <section className={`style-card style-${style.key}`}>
    <p className="eyebrow">YOUR PRICE STYLE</p>
    <h2>{style.name}</h2>
    <p>{style.line}</p>
    <p className="caption">Your guesses ran {lean}.</p>
  </section>;
}

export function DailyShare({ room }) {
  const [copied, setCopied] = useState(false);
  const [streak] = useState(() => recordStreak(room.dailyDate));
  const mine = room.history.map(h => h.rankings.find(r => r.playerId === room.selfId)).filter(Boolean);
  const avg = mine.length ? Math.round(mine.reduce((a, r) => a + r.accuracy, 0) / mine.length) : 0;
  const text = `Hunch daily ${room.dailyDate}\n${mine.map(r => tile(r.accuracy)).join('')} ${avg}% accurate${streak.current > 1 ? ` · ${streak.current}-day streak` : ''}${room.priceStyle ? `\nI'm a ${room.priceStyle.name}` : ''}`;
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    } catch { /* user cancelled share */ }
  };
  return <section className="daily-share">
    <p className="eyebrow">TODAY’S FIVE · {room.dailyDate}</p>
    <div className="daily-tiles" aria-label={`Accuracy by round: ${mine.map(r => `${Math.round(r.accuracy)}%`).join(', ')}`}>{mine.map((r, i) => <span key={i}><i className={`daily-tile daily-tile-${level(r.accuracy)}`} aria-hidden="true" /><small>{Math.round(r.accuracy)}%</small></span>)}</div>
    <h2>{avg}% accurate</h2>
    <p className="daily-streak"><strong>{streak.current ?? 1}</strong> day streak · best {streak.best ?? 1}</p>
    <button className="btn-primary" onClick={share}>{copied ? <Check size={20} /> : <Share2 size={20} />}<span>{copied ? 'Copied — paste it anywhere' : 'Share my result'}</span></button>
    <p className="caption">Five new items every day at 8am Singapore time.</p>
  </section>;
}
