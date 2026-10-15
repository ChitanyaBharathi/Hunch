import { pct } from '../format';
import { DataTable } from './ChartFrame';

// Two small diverging bar columns per row: perception gap and value gap, each from a zero line.
// One hue (the accent); the sign is carried by direction and the printed value, never by colour.
function Bar({ value, max }) {
  if (value === null || value === undefined) return <div className="hi-gap-cell hi-muted">—</div>;
  const w = Math.min(50, (Math.abs(value) / max) * 50);
  return <div className="hi-gap-cell">
    <div className="hi-gap-track"><span className="hi-gap-zero" /><span className="hi-gap-bar" style={{ width: `${w}%`, [value < 0 ? 'right' : 'left']: '50%', borderRadius: value < 0 ? '4px 0 0 4px' : '0 4px 4px 0' }} /></div>
    <strong>{pct(value)}</strong>
  </div>;
}

export function GapBars({ rows, caption, columns = ['Perception gap', 'Value gap'] }) {
  const single = columns.length === 1;
  const max = Math.max(0.2, ...rows.flatMap(r => [r.perception, r.value]).filter(v => v !== null && v !== undefined).map(v => Math.abs(Math.max(v, -1))));
  return <figure className="hi-chart">
    <div className="hi-gap-grid" role="table" aria-label={caption}>
      <div className={`hi-gap-head${single ? ' hi-gap-single' : ''}`} role="row"><span role="columnheader">{single ? 'Product' : 'Group'}</span>{columns.map(c => <span key={c} role="columnheader">{c}</span>)}</div>
      {rows.map(r => <div key={r.label} className={`hi-gap-row${single ? ' hi-gap-single' : ''}`} role="row">
        <div role="cell"><strong>{r.label}</strong><small>{r.sub}</small></div>
        <div role="cell"><Bar value={r.perception} max={max} /></div>
        {!single && <div role="cell"><Bar value={r.value} max={max} /></div>}
      </div>)}
    </div>
    <DataTable caption={caption} columns={[single ? 'Product' : 'Group', 'Responses', ...columns]} rows={rows.map(r => [r.label, r.n, pct(r.perception), ...(single ? [] : [pct(r.value)])])} />
  </figure>;
}
