import { productPerception, perceptionGap, valueGap } from './perception.js';
import { sensitivityCurves } from './sensitivity.js';
import { anchoringEffect } from './anchoring.js';
import { buildPersonas, personaView } from './personas.js';
import { THRESHOLDS } from './thresholds.js';
import { brandEffect } from './brand.js';

export const sgd = cents => {
  const dollars = cents / 100;
  return `S$${dollars >= 100 || cents % 100 === 0 ? Math.round(dollars).toLocaleString('en-SG') : dollars.toFixed(2)}`;
};

// Signature chart quadrants. x = perception gap (guess vs price), y = value gap (most they'd pay vs price).
export function quadrant(x, y) {
  if (x < 0) return y >= 0 ? 'Hidden Gem' : 'Sticker Shock';
  return y >= 0 ? 'Fair Value' : 'Overestimated';
}
export const QUADRANTS = {
  'Hidden Gem': 'Thought cheaper than it is, yet people would pay more than the price. Room to raise the price, or to market the value.',
  'Sticker Shock': 'Thought cheaper than it is, and people would not pay the real price. Communicate value before showing the price.',
  Overestimated: 'Thought pricier than it is, but people would not pay what they imagined. The real price is a pleasant surprise: lead with it in ads.',
  'Fair Value': 'Thought pricier than it is, and people would still pay at least the real price. The price feels fair.',
};

export function headline(name, p) {
  const think = `Shoppers think the ${name} costs ${sgd(p.perceived.medianCents)}. It costs ${sgd(p.currentCents)}.`;
  return p.valueGap.suppressed ? think : `${think} They'd pay up to ${sgd(p.valueGap.medianMaxPayCents)}.`;
}

// Answers that can't be a real attempt: more than 10× off either way (joke guesses), or locked in under 1.5 s (didn't look).
// They stay stored; reports leave them out and say how many.
export const QUALITY = { maxRatio: 10, minMs: 1500 };
export const usable = r => {
  const ratio = r.guessCents / r.actualCents;
  return ratio <= QUALITY.maxRatio && ratio >= 1 / QUALITY.maxRatio && !(r.msToAnswer !== null && r.msToAnswer !== undefined && r.msToAnswer < QUALITY.minMs);
};

// products: [{ id, name, brand, category, priceCents }]   rows: research rows in scope
// personaRows: rows to fit personas on (default: rows)    anchorRows: rows for the anchoring regression (default: rows)
export function buildReport({ products, rows: allRows, personaRows: allPersonaRows = allRows, anchorRows: allAnchorRows = allRows, categories, generatedAt = new Date().toISOString() }) {
  const rows = allRows.filter(usable);
  const personaRows = allPersonaRows.filter(usable);
  const anchorRows = allAnchorRows.filter(usable);
  const personaFit = buildPersonas(personaRows, categories);
  const productReports = products.map((product, i) => {
    const all = rows.filter(r => r.productId === product.id);
    // Headline figures describe the product as sold; the unbranded arm only feeds the brand experiment.
    const own = all.filter(r => (r.frame ?? 'standard') === 'standard');
    const perception = productPerception(own, { currentCents: product.priceCents, seed: 7 + i });
    const base = { id: product.id, name: product.name, brand: product.brand ?? null, category: product.category, currentCents: product.priceCents ?? null };
    if (perception.suppressed) return { ...base, ...perception };
    const q = perception.valueGap.suppressed ? null : quadrant(perception.perceptionGap.pct, perception.valueGap.pct);
    return { ...base, ...perception, headline: headline(product.name, perception), quadrant: q,
      sensitivity: sensitivityCurves(own), personas: personaView(personaFit, own, perceptionGap, valueGap), brand: brandEffect(all, { seed: 11 + i }) };
  });
  const respondents = new Set(rows.map(r => r.respondentId));
  const dates = rows.map(r => r.answeredAt).sort();
  return {
    generatedAt, currency: 'SGD', thresholds: THRESHOLDS,
    sample: { responses: rows.length, respondents: respondents.size, firstAnsweredAt: dates[0] ?? null, lastAnsweredAt: dates.at(-1) ?? null,
      includesSyntheticData: rows.some(r => r.isSeed), excludedLowQuality: allRows.length - rows.length },
    products: productReports,
    map: productReports.filter(p => p.quadrant).map(p => ({ id: p.id, name: p.name, x: p.perceptionGap.pct, y: p.valueGap.pct, n: p.n, quadrant: p.quadrant })),
    quadrants: QUADRANTS,
    personas: personaFit.suppressed ? personaFit : { k: personaFit.k, silhouette: personaFit.silhouette, eligibleRespondents: personaFit.eligibleRespondents,
      list: personaFit.personas.filter(p => p.reported).map(({ name, description, size, profile }) => ({ name, description, size, profile })) },
    anchoring: anchoringEffect(anchorRows),
  };
}

// Aggregates only: one row per published product, then personas and the anchoring estimate.
const cell = v => `"${String(v ?? '').replaceAll('"', '""')}"`;
const pct = x => (x === null || x === undefined || Number.isNaN(x) ? '' : Math.round(x * 1000) / 10);
const dollars = c => (c === null || c === undefined ? '' : (c / 100).toFixed(2));
export function reportCsv(report) {
  const lines = [];
  const add = row => lines.push(row.map(cell).join(','));
  add(['section', 'product_id', 'product', 'category', 'n', 'current_price_sgd', 'median_guess_sgd', 'guess_p25_sgd', 'guess_p75_sgd', 'median_ci90_low_sgd', 'median_ci90_high_sgd',
    'perception_gap_pct', 'value_gap_n', 'value_gap_pct', 'median_max_pay_sgd', 'crowd_error_pct', 'average_individual_error_pct', 'quadrant']);
  for (const p of report.products.filter(x => !x.suppressed)) {
    add(['product', p.id, p.name, p.category, p.n, dollars(p.currentCents), dollars(p.perceived.medianCents), dollars(p.perceived.p25Cents), dollars(p.perceived.p75Cents),
      dollars(p.perceived.ci90Cents[0]), dollars(p.perceived.ci90Cents[1]), pct(p.perceptionGap.pct), p.valueGap.n, p.valueGap.suppressed ? '' : pct(p.valueGap.pct),
      p.valueGap.suppressed ? '' : dollars(p.valueGap.medianMaxPayCents), pct(p.crowd.crowdErrorPct), pct(p.crowd.averageIndividualErrorPct), p.quadrant ?? '']);
  }
  lines.push('');
  add(['section', 'persona', 'people', 'product_id', 'n', 'perception_gap_pct', 'value_gap_pct']);
  for (const p of report.products.filter(x => !x.suppressed)) for (const v of p.personas) {
    if (!v.product.suppressed) add(['persona', v.name, v.size, p.id, v.product.n, pct(v.product.perceptionGapPct), v.product.valueGap.suppressed ? '' : pct(v.product.valueGap.pct)]);
  }
  lines.push('');
  add(['section', 'n', 'respondents', 'slope', 'ci_low', 'ci_high', 'per_doubling_pct', 'per_doubling_ci_low_pct', 'per_doubling_ci_high_pct']);
  const a = report.anchoring;
  if (!a.suppressed) add(['anchoring', a.n, a.respondents, a.slope.toFixed(4), a.ci[0].toFixed(4), a.ci[1].toFixed(4), pct(a.perDoublingPct), pct(a.perDoublingCi[0]), pct(a.perDoublingCi[1])]);
  lines.push('');
  add(['section', 'product_id', 'product', 'n_with_brand', 'n_without_brand', 'brand_premium_pct', 'ci90_low_pct', 'ci90_high_pct']);
  for (const p of report.products.filter(x => !x.suppressed && x.brand && !x.brand.suppressed))
    add(['brand', p.id, p.name, p.brand.branded.n, p.brand.unbranded.n, pct(p.brand.premiumPct), pct(p.brand.ci90[0]), pct(p.brand.ci90[1])]);
  return lines.join('\r\n');
}
