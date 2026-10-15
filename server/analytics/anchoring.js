import { mean, sum, zFor, logBias } from './stats.js';
import { MIN_ANCHOR_N, MIN_ANCHOR_RESPONDENTS, suppressed } from './thresholds.js';

// Does an expensive previous item make people guess higher on the next one?
// Product order is shuffled, so what came before is random: a natural experiment.
//
//   y = ln(guess / actual)          perception bias
//   x = ln(prev_price / actual)     how expensive the previous item was relative to this one
//
// We compare guesses on the same product (product fixed effects: subtract each product's mean x and y). Without that,
// the regression is confounded: people underestimate expensive items, and `actual` sits inside both x and y.
// Standard errors are clustered by respondent, because one person answers several rounds.
export function anchoringEffect(rows, { level = 0.95, minN = MIN_ANCHOR_N, minRespondents = MIN_ANCHOR_RESPONDENTS } = {}) {
  const data = rows.filter(r => r.prevPriceCents > 0 && r.actualCents > 0 && r.guessCents > 0)
    .map(r => ({ product: r.productId, respondent: r.respondentId, x: Math.log(r.prevPriceCents / r.actualCents), y: logBias(r.guessCents, r.actualCents) }));
  const respondents = new Set(data.map(d => d.respondent)).size;
  if (data.length < minN || respondents < minRespondents) return { ...suppressed(data.length, minN), respondents };

  const byProduct = new Map();
  for (const d of data) byProduct.set(d.product, [...(byProduct.get(d.product) ?? []), d]);
  const centred = [];
  for (const group of byProduct.values()) {
    if (group.length < 2) continue;
    const mx = mean(group.map(d => d.x)), my = mean(group.map(d => d.y));
    for (const d of group) centred.push({ ...d, x: d.x - mx, y: d.y - my });
  }
  const sxx = sum(centred.map(d => d.x * d.x));
  if (!sxx) return { ...suppressed(data.length, minN), respondents };
  const slope = sum(centred.map(d => d.x * d.y)) / sxx;

  // Cluster-robust (sandwich) variance with the usual G/(G-1) small-sample correction.
  const scores = new Map();
  for (const d of centred) scores.set(d.respondent, (scores.get(d.respondent) ?? 0) + d.x * (d.y - slope * d.x));
  const g = scores.size;
  const se = Math.sqrt((g / (g - 1)) * sum([...scores.values()].map(s => s * s)) / (sxx * sxx));
  const z = zFor(level);
  const ci = [slope - z * se, slope + z * se];
  const perDoubling = b => Math.exp(b * Math.LN2) - 1;
  const effect = { slope, se, ci, level, n: centred.length, respondents: g, products: byProduct.size,
    perDoublingPct: perDoubling(slope), perDoublingCi: ci.map(perDoubling) };
  return { ...effect, significant: ci[0] > 0 || ci[1] < 0, sentence: anchoringSentence(effect) };
}

const pct = x => `${Math.abs(Math.round(x * 100))}%`;
export function anchoringSentence({ slope, perDoublingPct, perDoublingCi, ci, level }) {
  const range = `${Math.round(level * 100)}% interval: ${perDoublingCi[0] < 0 ? '−' : ''}${pct(perDoublingCi[0])} to ${perDoublingCi[1] < 0 ? '−' : ''}${pct(perDoublingCi[1])}`;
  if (ci[0] > 0) return `When the item shown just before cost twice as much, people guessed about ${pct(perDoublingPct)} higher on the next item (${range}). What sits next to a product on a shelf or page moves what people expect to pay.`;
  if (ci[1] < 0) return `When the item shown just before cost twice as much, people guessed about ${pct(perDoublingPct)} lower on the next item (${range}): a contrast effect rather than anchoring.`;
  return `We can't yet tell an anchoring effect apart from zero (${range}; slope ${slope.toFixed(3)}). More responses will narrow this.`;
}
