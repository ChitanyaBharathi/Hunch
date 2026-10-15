import { useWidth, pct, shortName, ticks } from '../format';
import { useTooltip, Tooltip, DataTable } from './ChartFrame';

// The signature chart. x = perception gap (guess vs price), y = value gap (most they'd pay vs price).
const CORNERS = [
  { name: 'Hidden Gem', x: 'left', y: 'top', hint: 'Thought cheaper · would pay more' },
  { name: 'Fair Value', x: 'right', y: 'top', hint: 'Thought pricier · would still pay' },
  { name: 'Sticker Shock', x: 'left', y: 'bottom', hint: "Thought cheaper · wouldn't pay" },
  { name: 'Overestimated', x: 'right', y: 'bottom', hint: 'Thought pricier · real price surprises' },
];

export function PerceptionMap({ points }) {
  const [ref, width] = useWidth();
  const { tip, show, hide } = useTooltip();
  const height = Math.min(520, Math.max(320, width * 0.72));
  const m = { top: 28, right: 24, bottom: 46, left: 52 };
  const span = v => Math.max(0.3, ...points.map(p => Math.abs(v(p)))) * 1.2;
  const sx = span(p => p.x), sy = span(p => Math.max(p.y, -1));
  const x = v => m.left + ((v + sx) / (2 * sx)) * (width - m.left - m.right);
  const y = v => m.top + ((sy - Math.max(v, -sy)) / (2 * sy)) * (height - m.top - m.bottom);
  return <figure className="hi-chart" ref={ref}>
    <svg width={width} height={height} role="img" aria-label="Price perception map: each product placed by perception gap and value gap">
      {ticks(-sx, sx, 4).map(t => <g key={`x${t}`}><line x1={x(t)} x2={x(t)} y1={m.top} y2={height - m.bottom} className={t === 0 ? 'hi-axis' : 'hi-grid'} /><text x={x(t)} y={height - m.bottom + 18} className="hi-tick" textAnchor="middle">{pct(t)}</text></g>)}
      {ticks(-sy, sy, 4).map(t => <g key={`y${t}`}><line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} className={t === 0 ? 'hi-axis' : 'hi-grid'} /><text x={m.left - 8} y={y(t) + 4} className="hi-tick" textAnchor="end">{pct(t)}</text></g>)}
      {CORNERS.map(c => <g key={c.name}>
        <text x={c.x === 'left' ? m.left + 10 : width - m.right - 10} y={c.y === 'top' ? m.top + 18 : height - m.bottom - 24} textAnchor={c.x === 'left' ? 'start' : 'end'} className="hi-quadrant">{c.name}</text>
        <text x={c.x === 'left' ? m.left + 10 : width - m.right - 10} y={c.y === 'top' ? m.top + 34 : height - m.bottom - 8} textAnchor={c.x === 'left' ? 'start' : 'end'} className="hi-quadrant-hint">{c.hint}</text>
      </g>)}
      <text x={width - m.right} y={height - 8} textAnchor="end" className="hi-axis-title">Perception gap: guessed vs real price →</text>
      <text transform={`translate(14 ${m.top}) rotate(90)`} className="hi-axis-title">← Value gap: most they'd pay vs real price</text>
      {points.map(p => {
        const cx = x(p.x), cy = y(Math.max(p.y, -sy));
        const right = cx < width - 150;
        const rows = [[pct(p.x), 'perception gap'], [pct(p.y), 'value gap'], [p.n, 'responses'], [p.quadrant, '']];
        return <g key={p.id} tabIndex={0} onPointerMove={e => show(e, [[p.name, ''], ...rows])} onPointerLeave={hide}
          onFocus={e => show(e, [[p.name, ''], ...rows])} onBlur={hide} className="hi-point">
          <circle cx={cx} cy={cy} r={16} fill="transparent" />
          <circle cx={cx} cy={cy} r={6} className="hi-dot" />
          <text x={right ? cx + 11 : cx - 11} y={cy + 4} textAnchor={right ? 'start' : 'end'} className="hi-label">{shortName(p.name, 22)}</text>
        </g>;
      })}
    </svg>
    <Tooltip tip={tip} />
    <DataTable caption="Perception map values" columns={['Product', 'Perception gap', 'Value gap', 'Responses', 'Quadrant']}
      rows={points.map(p => [p.name, pct(p.x), pct(p.y), p.n, p.quadrant])} />
  </figure>;
}
