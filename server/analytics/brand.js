import { median, quantile, rng, logBias, pctFromLog } from './stats.js';
import { MIN_SEGMENT_N, suppressed } from './thresholds.js';

// Brand premium for one product: how much higher people guess when the brand is shown than when the same item is
// described without it. Arms are assigned at random per round, so the difference is the brand's effect on
// perceived price. Reported as a ratio of median guesses, with a bootstrap 90% interval.
export function brandEffect(rows, { seed = 11, reps = 1000, minimum = MIN_SEGMENT_N } = {}) {
  const arm = frame => rows.filter(r => (r.frame ?? 'standard') === frame).map(r => logBias(r.guessCents, r.actualCents));
  const branded = arm('standard'), plain = arm('unbranded');
  if (!plain.length) return null;
  if (branded.length < minimum || plain.length < minimum) return { ...suppressed(Math.min(branded.length, plain.length), minimum), branded: branded.length, unbranded: plain.length };
  const diff = median(branded) - median(plain);
  // Resample people, not answers: one person's answers move together, so treating them as independent overstates certainty.
  const people = [...rows.reduce((m, r) => m.set(r.respondentId, [...(m.get(r.respondentId) ?? []), r]), new Map()).values()];
  const rand = rng(seed);
  const boots = Array.from({ length: reps }, () => {
    const b = [], p = [];
    for (let k = 0; k < people.length; k++) for (const r of people[Math.floor(rand() * people.length)]) ((r.frame ?? 'standard') === 'standard' ? b : p).push(logBias(r.guessCents, r.actualCents));
    return b.length && p.length ? median(b) - median(p) : diff;
  });
  const ci = [quantile(boots, 0.05), quantile(boots, 0.95)].map(pctFromLog);
  return { suppressed: false, premiumPct: pctFromLog(diff), ci90: ci, clear: ci[0] > 0 || ci[1] < 0,
    branded: { n: branded.length, medianBiasPct: pctFromLog(median(branded)) }, unbranded: { n: plain.length, medianBiasPct: pctFromLog(median(plain)) } };
}
