import { useState } from 'react';

// Shared chart chrome: a title, the SVG, one floating tooltip, and a table view (so nothing is gated on hover or colour).
export function useTooltip() {
  const [tip, setTip] = useState(null);
  const show = (event, rows) => {
    const box = event.currentTarget.ownerSVGElement?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect();
    const x = (event.clientX ?? box.left + box.width / 2) - box.left;
    const y = (event.clientY ?? box.top) - box.top;
    setTip({ x, y, rows, flip: x > box.width * 0.6 });
  };
  return { tip, show, hide: () => setTip(null) };
}

export function Tooltip({ tip }) {
  if (!tip) return null;
  return <div className="hi-tooltip" style={{ left: tip.x, top: tip.y, transform: `translate(${tip.flip ? 'calc(-100% - 14px)' : '14px'}, -50%)` }} role="status">
    {tip.rows.map(([value, label, key], i) => <div key={i} className="hi-tooltip-row">
      {key && <span className="hi-key-line" style={{ background: key }} aria-hidden="true" />}
      <strong>{value}</strong><span>{label}</span>
    </div>)}
  </div>;
}

export function DataTable({ caption, columns, rows }) {
  return <details className="hi-table">
    <summary>Show the numbers</summary>
    <div className="hi-table-scroll"><table>
      <caption className="hi-sr">{caption}</caption>
      <thead><tr>{columns.map(c => <th key={c} scope="col">{c}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((v, j) => (j === 0 ? <th key={j} scope="row">{v}</th> : <td key={j}>{v}</td>))}</tr>)}</tbody>
    </table></div>
  </details>;
}
