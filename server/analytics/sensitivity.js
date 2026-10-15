import { median, quantile } from './stats.js';
import { MIN_PRODUCT_N, suppressed } from './thresholds.js';

// A lighter, 3-question variant inspired by the Van Westendorp Price Sensitivity Meter (which uses 4 questions).
// From each respondent's "too cheap to trust", expected price (their guess) and "most I'd pay":
//   too cheap(p)     share who said p is so low they'd doubt quality   (too_cheap >= p, falls as p rises)
//   expected(p)      share whose guess is at or below p                 (rises as p rises)
//   too expensive(p) share for whom p is above the most they'd pay      (max_pay < p, rises as p rises)
export const VARIANT_LABEL = 'Lighter 3-question variant inspired by the Van Westendorp Price Sensitivity Meter (the full method asks 4 questions).';

const share = (values, test) => values.filter(test).length / values.length;

export function sensitivityCurves(rows, { points = 40, minimum = MIN_PRODUCT_N } = {}) {
  const tooCheap = rows.map(r => r.tooCheapCents).filter(v => v !== null && v !== undefined);
  const guesses = rows.map(r => r.guessCents);
  const maxPay = rows.map(r => r.maxPayCents).filter(v => v !== null && v !== undefined);
  const n = { tooCheap: tooCheap.length, expected: guesses.length, maxPay: maxPay.length };
  if (Math.min(n.tooCheap, n.expected, n.maxPay) < minimum) return { ...suppressed(Math.min(n.tooCheap, n.expected, n.maxPay), minimum), counts: n };

  const tooCheapAt = p => share(tooCheap, v => v >= p);
  const expectedAt = p => share(guesses, v => v <= p);
  const tooExpensiveAt = p => share(maxPay, v => v < p);

  const all = [...tooCheap, ...guesses, ...maxPay].filter(v => v > 0);
  const lo = Math.max(1, quantile(all, 0.02) * 0.8);
  const hi = quantile(all, 0.98) * 1.2;
  // Log-spaced grid: prices are judged in ratios, not absolute steps.
  const grid = Array.from({ length: points }, (_, i) => Math.round(lo * (hi / lo) ** (i / (points - 1))));
  const curves = grid.map(price => ({ priceCents: price, tooCheap: tooCheapAt(price), expected: expectedAt(price), tooExpensive: tooExpensiveAt(price) }));

  // Balance point: where "too cheap" and "too expensive" cross (falling minus rising, so bisect on the sign).
  let a = lo, b = hi, balance = null;
  if (tooCheapAt(a) - tooExpensiveAt(a) >= 0 && tooCheapAt(b) - tooExpensiveAt(b) <= 0) {
    for (let i = 0; i < 60; i++) { const m = Math.sqrt(a * b); if (tooCheapAt(m) - tooExpensiveAt(m) > 0) a = m; else b = m; }
    balance = Math.round(Math.sqrt(a * b));
  }
  return {
    n, label: VARIANT_LABEL, curves,
    points: {
      floorCents: Math.round(median(tooCheap)),   // half think anything below this is too cheap to trust
      expectedCents: Math.round(median(guesses)), // half expect it to cost at most this
      balanceCents: balance,                      // as many find it too cheap as too expensive
      ceilingCents: Math.round(median(maxPay)),   // half would not pay more than this
    },
  };
}
