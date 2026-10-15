import { useEffect, useRef, useState } from 'react';

export const sgd = cents => {
  if (cents === null || cents === undefined) return '—';
  const dollars = cents / 100;
  return `S$${dollars >= 100 || cents % 100 === 0 ? Math.round(dollars).toLocaleString('en-SG') : dollars.toFixed(2)}`;
};
// Signed percentage from a ratio (-0.22 → "−22%").
export const pct = (x, { signed = true } = {}) => {
  if (x === null || x === undefined || Number.isNaN(x)) return '—';
  const v = Math.round(x * 100);
  return `${signed && v > 0 ? '+' : ''}${v < 0 ? '−' : ''}${Math.abs(v)}%`;
};
export const gapWords = x => (x < 0 ? `${pct(-x, { signed: false })} cheaper` : x > 0 ? `${pct(x, { signed: false })} pricier` : 'spot on');
export const shortName = (name, max = 26) => (name.length > max ? `${name.slice(0, max - 1)}…` : name);
export const date = iso => (iso ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

// Width of a container, so SVG charts draw at real pixel size on any screen.
export function useWidth(fallback = 640) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    if (!ref.current) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(260, Math.floor(entry.contentRect.width))));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

// Nice tick values for a linear domain.
export function ticks(min, max, count = 5) {
  const span = max - min;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= step0) ?? 10 * mag;
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

// Nice ticks for a log price axis (cents): 1–2–5 steps.
export function logTicks(min, max) {
  const out = [];
  for (let e = Math.floor(Math.log10(min)); e <= Math.ceil(Math.log10(max)); e++) {
    for (const m of [1, 2, 5]) { const v = m * 10 ** e; if (v >= min && v <= max) out.push(v); }
  }
  return out.length >= 2 ? out : [min, max];
}
