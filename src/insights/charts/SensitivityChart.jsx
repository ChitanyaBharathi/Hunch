import { useState } from 'react';
import { useWidth, sgd, pct, logTicks } from '../format';
import { DataTable } from './ChartFrame';

// Three cumulative curves (lighter 3-question variant of Van Westendorp). Colours: validated categorical slots 1–3.
const SERIES = [
  { key: 'tooCheap', label: 'Too cheap to trust', color: 'var(--hi-series-1)' },
  { key: 'expected', label: 'Expected price', color: 'var(--hi-series-2)' },
  { key: 'tooExpensive', label: 'Too expensive', color: 'var(--hi-series-3)' },
];

export function SensitivityChart({ sensitivity }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const { curves, points } = sensitivity;
  const height = Math.min(340, Math.max(240, width * 0.5));
  const m = { top: 18, right: 16, bottom: 40, left: 44 };
  const lo = curves[0].priceCents, hi = curves.at(-1).priceCents;
  const x = v => m.left + (Math.log(v / lo) / Math.log(hi / lo)) * (width - m.left - m.right);
  const y = v => m.top + (1 - v) * (height - m.top - m.bottom);
  const path = key => curves.map((c, i) => `${i ? 'L' : 'M'}${x(c.priceCents).toFixed(1)},${y(c[key]).toFixed(1)}`).join('');
  const nearest = px => curves.reduce((best, c) => (Math.abs(x(c.priceCents) - px) < Math.abs(x(best.priceCents) - px) ? c : best), curves[0]);
  const onMove = e => { const box = e.currentTarget.getBoundingClientRect(); setHover(nearest(e.clientX - box.left)); };
  const marks = [['Balance point', points.balanceCents]].filter(([, v]) => v && v > lo && v < hi);
  return <figure className="hi-chart" ref={ref}>
    <ul className="hi-legend">{SERIES.map(s => <li key={s.key}><span className="hi-key-line" style={{ background: s.color }} />{s.label}</li>)}</ul>
    <svg width={width} height={height} role="img" aria-label="Price sensitivity curves" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
      {[0, 0.25, 0.5, 0.75, 1].map(t => <g key={t}><line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} className={t === 0 ? 'hi-axis' : 'hi-grid'} /><text x={m.left - 8} y={y(t) + 4} textAnchor="end" className="hi-tick">{Math.round(t * 100)}%</text></g>)}
      {logTicks(lo, hi).map(t => <text key={t} x={x(t)} y={height - m.bottom + 18} textAnchor="middle" className="hi-tick">{sgd(t)}</text>)}
      {marks.map(([label, v]) => <g key={label}><line x1={x(v)} x2={x(v)} y1={m.top} y2={height - m.bottom} className="hi-grid hi-strong-grid" /><text x={x(v) + 4} y={m.top + 10} className="hi-tick">{label} {sgd(v)}</text></g>)}
      {SERIES.map(s => <path key={s.key} d={path(s.key)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />)}
      {/* Direct labels where each curve crosses 50% (floor, expected, ceiling), alternating above and below the line. */}
      {SERIES.map((s, i) => {
        const at = { tooCheap: points.floorCents, expected: points.expectedCents, tooExpensive: points.ceilingCents }[s.key];
        if (!at || at <= lo || at >= hi) return null;
        const above = i !== 1;
        const anchor = x(at) > width - 90 ? 'end' : x(at) < 90 ? 'start' : 'middle';
        return <text key={s.key} x={x(at)} y={y(0.5) + (above ? -10 - i * 2 : 18)} textAnchor={anchor} className="hi-label">{s.label}</text>;
      })}
      {hover && <g pointerEvents="none">
        <line x1={x(hover.priceCents)} x2={x(hover.priceCents)} y1={m.top} y2={height - m.bottom} className="hi-crosshair" />
        {SERIES.map(s => <circle key={s.key} cx={x(hover.priceCents)} cy={y(hover[s.key])} r={4} fill={s.color} className="hi-ring" />)}
      </g>}
      <rect x={m.left} y={m.top} width={width - m.left - m.right} height={height - m.top - m.bottom} fill="transparent" />
    </svg>
    {hover && <div className="hi-tooltip hi-tooltip-fixed" style={{ left: Math.min(x(hover.priceCents) + 14, width - 190) }} role="status">
      <div className="hi-tooltip-row"><strong>{sgd(hover.priceCents)}</strong><span>price</span></div>
      {SERIES.map(s => <div key={s.key} className="hi-tooltip-row"><span className="hi-key-line" style={{ background: s.color }} /><strong>{pct(hover[s.key], { signed: false })}</strong><span>{s.label.toLowerCase()}</span></div>)}
    </div>}
    <p className="hi-caption">{sensitivity.label} Based on {sensitivity.n.tooCheap} "too cheap", {sensitivity.n.expected} expected-price and {sensitivity.n.maxPay} "most I'd pay" answers.</p>
    <DataTable caption="Price sensitivity points" columns={['Point', 'Price', 'Meaning']} rows={[
      ['Floor', sgd(points.floorCents), 'Half think anything below this is too cheap to trust'],
      ['Expected', sgd(points.expectedCents), 'Half expect it to cost at most this'],
      ['Balance', sgd(points.balanceCents), 'As many find it too cheap as too expensive'],
      ['Ceiling', sgd(points.ceilingCents), 'Half would not pay more than this'],
    ]} />
  </figure>;
}
