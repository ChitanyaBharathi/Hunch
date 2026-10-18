import { sgd } from '../analytics/report.js';

// The analyst agent's tools. Each one reads the finished study report: aggregates that already passed the
// minimum-group thresholds. The agent never sees raw guesses, respondents or anything the dashboard withholds.

const pct = x => (x === null || x === undefined || Number.isNaN(x) ? null : Math.round(x * 1000) / 10); // 0.224 → 22.4
const withheld = p => ({ withheld: true, reason: `Not enough responses: ${p.n} of ${p.minimum} needed.` });

function findProduct(report, ref) {
  const wanted = String(ref ?? '').trim().toLowerCase();
  if (!wanted) return null;
  return report.products.find(p => p.id.toLowerCase() === wanted)
    ?? report.products.find(p => p.name.toLowerCase() === wanted)
    ?? report.products.find(p => p.name.toLowerCase().includes(wanted) || wanted.includes(p.name.toLowerCase()))
    ?? null;
}

function overview(report) {
  const { study, sample } = report;
  return {
    study: study ? { title: study.title, window: `${study.startsOn} to ${study.endsOn}`, status: study.status, targetResponses: study.minResponses } : null,
    sample: { responses: sample.responses, respondents: sample.respondents, excludedAsNotRealAttempts: sample.excludedLowQuality, includesSyntheticDemoData: sample.includesSyntheticData },
    products: report.products.map(p => p.suppressed
      ? { id: p.id, name: p.name, category: p.category, ...withheld(p) }
      : { id: p.id, name: p.name, brand: p.brand, category: p.category, realPrice: sgd(p.currentCents), responses: p.n,
        medianGuess: sgd(p.perceived.medianCents), perceptionGapPct: pct(p.perceptionGap.pct), quadrant: p.quadrant }),
    personasAvailable: !report.personas.suppressed,
    anchoringAvailable: !report.anchoring.suppressed,
  };
}

function productDetail(report, { product }) {
  const p = findProduct(report, product);
  if (!p) return { error: `No product matching "${product}". Products: ${report.products.map(x => x.name).join(', ')}.` };
  if (p.suppressed) return { name: p.name, ...withheld(p) };
  const s = p.sensitivity;
  const c = p.confidence;
  const b = p.brand;
  return {
    name: p.name, brand: p.brand, category: p.category, realPrice: sgd(p.currentCents), responses: p.n,
    guesses: { median: sgd(p.perceived.medianCents), middleHalf: `${sgd(p.perceived.p25Cents)} to ${sgd(p.perceived.p75Cents)}`,
      medianInterval90: `${sgd(p.perceived.ci90Cents[0])} to ${sgd(p.perceived.ci90Cents[1])}` },
    perceptionGapPct: pct(p.perceptionGap.pct),
    valueGap: p.valueGap.suppressed ? withheld(p.valueGap) : { pct: pct(p.valueGap.pct), medianMostTheydPay: sgd(p.valueGap.medianMaxPayCents), answers: p.valueGap.n },
    quadrant: p.quadrant ? { name: p.quadrant, meaning: report.quadrants[p.quadrant] } : null,
    crowd: { crowdMedianErrorPct: pct(p.crowd.crowdErrorPct), averagePlayerErrorPct: pct(p.crowd.averageIndividualErrorPct), crowdBeatsShareOfPlayersPct: pct(p.crowd.beatenShare) },
    confidence: c.suppressed ? withheld(c) : { splitAtSeconds: c.medianSeconds, fastTypicalErrorPct: pct(c.fast.typicalErrorPct), slowTypicalErrorPct: pct(c.slow.typicalErrorPct), priceIsWellKnown: c.wellKnown },
    brandExperiment: !b ? 'Not run for this product (no unbranded version shown).' : b.suppressed ? withheld(b)
      : { brandPremiumPct: pct(b.premiumPct), interval90Pct: [pct(b.ci90[0]), pct(b.ci90[1])], clearlyNonZero: b.clear, withBrandN: b.branded.n, withoutBrandN: b.unbranded.n },
    priceSensitivity: s.suppressed ? withheld(s) : { tooCheapToTrustBelow: sgd(s.points.floorCents), typicalExpected: sgd(s.points.expectedCents),
      balancePoint: s.points.balanceCents ? sgd(s.points.balanceCents) : null, halfWouldNotPayAbove: sgd(s.points.ceilingCents) },
    byPersona: p.personas.map(v => v.product.suppressed ? { persona: v.name, ...withheld(v.product) }
      : { persona: v.name, responses: v.product.n, perceptionGapPct: pct(v.product.perceptionGapPct), valueGapPct: v.product.valueGap.suppressed ? null : pct(v.product.valueGap.pct) }),
    byAgeBand: p.ageBands.map(a => ({ ageBand: a.segment, responses: a.n, perceptionGapPct: pct(a.perceptionGapPct), valueGapPct: a.valueGap.suppressed ? null : pct(a.valueGap.pct) })),
  };
}

const METRICS = {
  perception_gap: { label: 'Perception gap % (negative = thought cheaper than it is)', value: p => pct(p.perceptionGap.pct) },
  value_gap: { label: 'Value gap % (most they would pay vs real price)', value: p => (p.valueGap.suppressed ? null : pct(p.valueGap.pct)) },
  brand_premium: { label: 'Brand premium % on perceived price', value: p => (p.brand && !p.brand.suppressed ? pct(p.brand.premiumPct) : null) },
  crowd_error: { label: 'Crowd median error %', value: p => pct(p.crowd.crowdErrorPct) },
  responses: { label: 'Responses', value: p => p.n },
};

function compare(report, { metric }) {
  const m = METRICS[metric];
  if (!m) return { error: `Unknown metric "${metric}". Use one of: ${Object.keys(METRICS).join(', ')}.` };
  const rows = report.products.filter(p => !p.suppressed).map(p => ({ name: p.name, category: p.category, value: m.value(p),
    ...(metric === 'brand_premium' && p.brand && !p.brand.suppressed ? { interval90Pct: [pct(p.brand.ci90[0]), pct(p.brand.ci90[1])], clearlyNonZero: p.brand.clear } : {}) }));
  return { metric: m.label, ranked: rows.filter(r => r.value !== null).sort((a, b) => b.value - a.value),
    notAvailable: [...rows.filter(r => r.value === null).map(r => r.name), ...report.products.filter(p => p.suppressed).map(p => `${p.name} (withheld)`)] };
}

function personas(report) {
  const fit = report.personas;
  if (fit.suppressed) return { withheld: true, reason: `Personas need ${fit.minimum} eligible respondents; there are ${fit.n}.` };
  return { groups: fit.list.length, clusteringQuality: { k: fit.k, silhouette: fit.silhouette, note: 'Silhouette near 1 = clearly separate groups, near 0 = overlapping.' },
    eligibleRespondents: fit.eligibleRespondents,
    personas: fit.list.map(p => ({ name: p.name, people: p.size, description: p.description,
      biasByCategoryPct: Object.fromEntries(Object.entries(p.profile).map(([k, v]) => [k, pct(v)])) })) };
}

function anchoring(report) {
  const a = report.anchoring;
  if (a.suppressed) return { withheld: true, reason: `Needs ${a.minimum} responses with a previous item from 10 people; there are ${a.n}.` };
  return { changeWhenPreviousItemCostTwiceAsMuchPct: pct(a.perDoublingPct), interval95Pct: [pct(a.perDoublingCi[0]), pct(a.perDoublingCi[1])],
    clearlyNonZero: a.significant, responses: a.n, respondents: a.respondents, summary: a.sentence };
}

function methodology(report) {
  const m = report.methodology;
  return typeof m === 'string' ? { summary: m } : { ...m, minimumGroupSizes: report.thresholds };
}

// Gemini function declarations (OpenAPI-style schemas) and the code that answers each one.
export const TOOLS = [
  { name: 'get_study_overview', description: 'Study title, dates, sample size and a one-line summary of every product (median guess vs real price). Call this first.',
    parameters: { type: 'object', properties: {} }, run: overview },
  { name: 'get_product_insights', description: 'Everything measured for one product: guesses, perception gap, value gap, crowd accuracy, answer-speed confidence, brand experiment, price sensitivity points, and splits by persona and age band.',
    parameters: { type: 'object', properties: { product: { type: 'string', description: 'Product id or name, as listed by get_study_overview.' } }, required: ['product'] }, run: productDetail },
  { name: 'compare_products', description: 'Rank all products in the study on one metric.',
    parameters: { type: 'object', properties: { metric: { type: 'string', enum: Object.keys(METRICS) } }, required: ['metric'] }, run: compare },
  { name: 'get_personas', description: 'Shopper personas found by k-means clustering of how each regular player misjudges prices per category.',
    parameters: { type: 'object', properties: {} }, run: personas },
  { name: 'get_anchoring_effect', description: 'Whether the price of the item shown just before shifts the next guess (a natural experiment from the shuffled order).',
    parameters: { type: 'object', properties: {} }, run: anchoring },
  { name: 'get_methodology', description: 'How the data was collected, what was excluded, minimum group sizes, and known biases. Use when asked how reliable a finding is.',
    parameters: { type: 'object', properties: {} }, run: methodology },
];

export function runTool(report, name, args = {}) {
  const tool = TOOLS.find(t => t.name === name);
  if (!tool) return { error: `Unknown tool "${name}".` };
  try { return tool.run(report, args ?? {}); } catch (error) { return { error: `Tool failed: ${error.message}` }; }
}
