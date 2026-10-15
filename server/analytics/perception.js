import { median, quantile, mean, bootstrapMedianCI, logBias, pctFromLog } from './stats.js';
import { MIN_PRODUCT_N, MIN_SEGMENT_N, suppressed } from './thresholds.js';

// Rows are research responses for ONE product: { guessCents, actualCents, maxPayCents, tooCheapCents, msToAnswer, ageBand }.
const biasOf = r => logBias(r.guessCents, r.actualCents);
// A maximum-pay of 0 means "would not buy at any price": ln(0) = -Infinity, which a median handles correctly.
const valueOf = r => (r.maxPayCents > 0 ? logBias(r.maxPayCents, r.actualCents) : -Infinity);
const round = (x, dp = 4) => (Number.isFinite(x) ? Math.round(x * 10 ** dp) / 10 ** dp : x === -Infinity ? null : x);

export function valueGap(rows, minimum = MIN_PRODUCT_N) {
  const answered = rows.filter(r => r.maxPayCents !== null && r.maxPayCents !== undefined);
  if (answered.length < minimum) return suppressed(answered.length, minimum);
  const medianLog = median(answered.map(valueOf));
  return { n: answered.length, medianLog: round(medianLog), pct: round(pctFromLog(medianLog)), medianMaxPayCents: Math.round(median(answered.map(r => r.maxPayCents))) };
}

export function perceptionGap(rows, minimum = MIN_PRODUCT_N) {
  if (rows.length < minimum) return suppressed(rows.length, minimum);
  const medianLog = median(rows.map(biasOf));
  return { n: rows.length, medianLog: round(medianLog), pct: round(pctFromLog(medianLog)) };
}

// "Wisdom of the crowd": how far the crowd's median guess was from the price vs how far the average player was.
export function crowdAccuracy(rows) {
  const biases = rows.map(biasOf);
  const crowdLog = Math.abs(median(biases));
  const errors = biases.map(Math.abs);
  return { crowdErrorPct: round(pctFromLog(crowdLog)), averageIndividualErrorPct: round(pctFromLog(mean(errors))),
    beatenShare: round(errors.filter(e => e > crowdLog).length / errors.length) };
}

// A quantile dot plot instead of raw guesses: each dot stands for an equal share of guesses, rounded, and there are
// always at least three guesses per dot, so no single response is ever sent to the browser.
export function quantileDots(values, maxDots = 50) {
  const dots = Math.max(1, Math.min(maxDots, Math.floor(values.length / 3)));
  return Array.from({ length: dots }, (_, i) => {
    const v = quantile(values, (i + 0.5) / dots);
    const step = v >= 10000 ? 100 : v >= 2000 ? 50 : 10; // cents: whole dollars, 50c or 10c
    return Math.round(v / step) * step;
  });
}

// Fast vs slow answers (split at the product's median time). Fast and accurate means the price is well known.
export function confidenceSignal(rows, minimum = MIN_SEGMENT_N) {
  const timed = rows.filter(r => Number.isFinite(r.msToAnswer));
  if (timed.length < minimum) return suppressed(timed.length, minimum);
  const cut = median(timed.map(r => r.msToAnswer));
  const fast = timed.filter(r => r.msToAnswer <= cut);
  const slow = timed.filter(r => r.msToAnswer > cut);
  if (fast.length < minimum / 2 || slow.length < minimum / 2) return suppressed(Math.min(fast.length, slow.length) * 2, minimum);
  const describe = group => ({ n: group.length, typicalErrorPct: round(pctFromLog(median(group.map(r => Math.abs(biasOf(r)))))), gapPct: round(pctFromLog(median(group.map(biasOf)))) });
  const f = describe(fast);
  const s = describe(slow);
  const known = f.typicalErrorPct < 0.15 && f.typicalErrorPct <= s.typicalErrorPct;
  return { n: timed.length, medianSeconds: Math.round(cut / 100) / 10, fast: f, slow: s, wellKnown: known };
}

// Splits by a respondent attribute (e.g. age band). Groups under the segment threshold are left out entirely.
export function segmentSplit(rows, key, minimum = MIN_SEGMENT_N) {
  const groups = new Map();
  for (const r of rows) if (r[key] && r[key] !== 'na') groups.set(r[key], [...(groups.get(r[key]) ?? []), r]);
  return [...groups].filter(([, g]) => g.length >= minimum).sort(([a], [b]) => String(a).localeCompare(String(b)))
    .map(([segment, g]) => ({ segment, n: g.length, perceptionGapPct: perceptionGap(g, minimum).pct, valueGap: valueGap(g, minimum) }));
}

// Everything about one product. `currentCents` is today's price for the headline; gaps use each row's own price.
export function productPerception(rows, { currentCents, seed = 7 } = {}) {
  if (rows.length < MIN_PRODUCT_N) return suppressed(rows.length, MIN_PRODUCT_N);
  const guesses = rows.map(r => r.guessCents);
  const [ciLow, ciHigh] = bootstrapMedianCI(guesses, { level: 0.9, seed });
  return {
    n: rows.length,
    currentCents: currentCents ?? rows.at(-1).actualCents,
    perceived: { medianCents: Math.round(median(guesses)), p25Cents: Math.round(quantile(guesses, 0.25)), p75Cents: Math.round(quantile(guesses, 0.75)),
      ci90Cents: [Math.round(ciLow), Math.round(ciHigh)] },
    perceptionGap: perceptionGap(rows),
    valueGap: valueGap(rows),
    crowd: crowdAccuracy(rows),
    distribution: { dotsCents: quantileDots(guesses), sharePerDot: round(1 / Math.max(1, Math.min(50, Math.floor(guesses.length / 3))), 3) },
    confidence: confidenceSignal(rows),
    ageBands: segmentSplit(rows, 'ageBand'),
  };
}
