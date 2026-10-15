import { useWidth, sgd, logTicks } from '../format';
import { useTooltip, Tooltip, DataTable } from './ChartFrame';

// Quantile dot plot as a beeswarm: each dot is an equal share of guesses (never a single person's answer).
// Vertical line = real price; shaded band = middle 50% of guesses.
export function GuessStrip({ product }) {
  const [ref, width] = useWidth();
  const { tip, show, hide } = useTooltip();
  const { dotsCents, sharePerDot } = product.distribution;
  const { p25Cents, p75Cents, medianCents } = product.perceived;
  const real = product.currentCents;
  const values = [...dotsCents, real, p25Cents, p75Cents];
  const lo = Math.min(...values) * 0.85, hi = Math.max(...values) * 1.15;
  const m = { left: 16, right: 16 };
  const x = v => m.left + (Math.log(v / lo) / Math.log(hi / lo)) * (width - m.left - m.right);
  const r = 5, gap = 2;
  // Simple beeswarm: place each dot at the lowest free height near the centre line.
  const placed = [];
  for (const v of [...dotsCents].sort((a, b) => a - b)) {
    const cx = x(v);
    let offset = 0;
    for (let k = 0; k < 40; k++) {
      const cy = k === 0 ? 0 : (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (2 * r + gap);
      if (!placed.some(p => Math.abs(p.cx - cx) < 2 * r + gap && Math.abs(p.cy - cy) < 2 * r + gap)) { offset = cy; break; }
    }
    placed.push({ v, cx, cy: offset });
  }
  const spread = Math.max(24, ...placed.map(p => Math.abs(p.cy) + r + 4));
  const mid = 34 + spread, height = mid + spread + 40;
  const share = `≈ ${Math.round(sharePerDot * 100)}% of guesses`;
  return <figure className="hi-chart" ref={ref}>
    <svg width={width} height={height} role="img" aria-label={`Guesses for ${product.name}: middle half between ${sgd(p25Cents)} and ${sgd(p75Cents)}; real price ${sgd(real)}`}>
      <rect x={x(p25Cents)} width={Math.max(2, x(p75Cents) - x(p25Cents))} y={mid - spread} height={2 * spread} className="hi-band" rx={4} />
      <line x1={m.left} x2={width - m.right} y1={height - 30} y2={height - 30} className="hi-axis" />
      {logTicks(lo, hi).map(t => <text key={t} x={x(t)} y={height - 12} textAnchor="middle" className="hi-tick">{sgd(t)}</text>)}
      {placed.map((p, i) => <g key={i} className="hi-point" tabIndex={-1} onPointerMove={e => show(e, [[sgd(p.v), share]])} onPointerLeave={hide}>
        <circle cx={p.cx} cy={mid + p.cy} r={r + 5} fill="transparent" />
        <circle cx={p.cx} cy={mid + p.cy} r={r} className="hi-dot" />
      </g>)}
      <line x1={x(real)} x2={x(real)} y1={22} y2={height - 30} className="hi-ref" />
      <text x={x(real)} y={14} textAnchor={x(real) > width - 120 ? 'end' : x(real) < 120 ? 'start' : 'middle'} className="hi-ref-label">Real price {sgd(real)}</text>
      <text x={x(medianCents)} y={mid + spread + 2} dy="-0.2em" textAnchor="middle" className="hi-label hi-muted" style={{ display: Math.abs(x(medianCents) - x(real)) < 70 ? 'none' : undefined }}>typical guess {sgd(medianCents)}</text>
    </svg>
    <Tooltip tip={tip} />
    <p className="hi-caption">Each dot stands for {share.replace('≈ ', 'about ')}. Shaded: the middle 50% of guesses ({sgd(p25Cents)}–{sgd(p75Cents)}).</p>
    <DataTable caption={`Guess distribution for ${product.name}`} columns={['Measure', 'Value']}
      rows={[['Real price', sgd(real)], ['Median guess', sgd(medianCents)], ['90% interval for the median', `${sgd(product.perceived.ci90Cents[0])}–${sgd(product.perceived.ci90Cents[1])}`],
        ['Middle 50% of guesses', `${sgd(p25Cents)}–${sgd(p75Cents)}`], ['Responses', product.n]]} />
  </figure>;
}
