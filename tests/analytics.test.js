import test from 'node:test';
import assert from 'node:assert/strict';
import { median, quantile, bootstrapMedianCI, logBias, pctFromLog, pearson } from '../server/analytics/stats.js';
import { productPerception, perceptionGap, valueGap, quantileDots, segmentSplit, confidenceSignal } from '../server/analytics/perception.js';
import { sensitivityCurves } from '../server/analytics/sensitivity.js';
import { quadrant, buildReport, reportCsv } from '../server/analytics/report.js';
import { similarity, priceTwin } from '../server/analytics/twins.js';
import { generateSynthetic } from '../server/seed/synthetic.js';
import { PRODUCTS } from '../server/products.js';

const row = (guess, extra = {}) => ({ respondentId: `r${guess}`, productId: 'p', category: 'Tech', guessCents: guess, actualCents: 10000, maxPayCents: null, tooCheapCents: null, msToAnswer: null, ...extra });

test('log bias treats double and half as equally far off, and reads back as a percentage', async () => {
  assert.equal(Math.abs(logBias(200, 100)), Math.abs(logBias(50, 100)));
  assert.ok(Math.abs(pctFromLog(Math.log(0.78)) - -0.22) < 1e-12);
  assert.equal(pctFromLog(-Infinity), -1);
  assert.equal(median([3, 1, 2]), 2); assert.equal(quantile([1, 2, 3, 4], 0.25), 1.75);
  assert.ok(Math.abs(pearson([1, 2, 3], [2, 4, 6]) - 1) < 1e-12);
});

test('threshold suppression: products need 5, segments need 10, and suppressed means no figures at all', async () => {
  const four = [8000, 9000, 10000, 11000].map(g => row(g));
  const p4 = productPerception(four);
  assert.deepEqual(p4, { suppressed: true, n: 4, minimum: 5 });
  const five = [...four, row(12000)];
  const p5 = productPerception(five);
  assert.equal(p5.n, 5); assert.equal(p5.perceived.medianCents, 10000);
  assert.ok(p5.valueGap.suppressed, 'no max-pay answers yet');
  assert.ok(p5.confidence.suppressed && p5.ageBands.length === 0);
  const nine = Array.from({ length: 9 }, (_, i) => row(9000 + i * 100, { ageBand: '18-24', msToAnswer: 1000 * i }));
  assert.equal(segmentSplit(nine, 'ageBand').length, 0);
  assert.ok(confidenceSignal(nine).suppressed);
  const ten = [...nine, row(9900, { ageBand: '18-24', msToAnswer: 50 })];
  assert.equal(segmentSplit(ten, 'ageBand')[0].n, 10);
  assert.ok(!confidenceSignal(ten).suppressed);
  // Report level: a suppressed product carries no numbers that could leak individual answers.
  const report = buildReport({ products: [{ id: 'p', name: 'Thing', category: 'Tech', priceCents: 10000 }], rows: four, categories: ['Tech'] });
  assert.deepEqual(Object.keys(report.products[0]).sort(), ['brand', 'category', 'currentCents', 'id', 'minimum', 'n', 'name', 'suppressed'].sort());
  assert.ok(!reportCsv(report).includes('8000') && !reportCsv(report).includes('80.00'));
});

test('perception and value gaps use medians on the log scale; zero max-pay means "would not buy"', async () => {
  const rows = [5000, 7000, 8000, 9000, 20000].map((g, i) => row(g, { maxPayCents: [0, 0, 0, 12000, 15000][i] }));
  assert.ok(Math.abs(perceptionGap(rows).pct - -0.2) < 1e-9);
  const v = valueGap(rows);
  assert.equal(v.pct, -1); assert.equal(v.medianMaxPayCents, 0);
});

test('bootstrap interval is reproducible and brackets the median', async () => {
  const values = Array.from({ length: 60 }, (_, i) => 1000 + i * 37);
  const a = bootstrapMedianCI(values, { seed: 3 });
  assert.deepEqual(a, bootstrapMedianCI(values, { seed: 3 }));
  assert.ok(a[0] <= median(values) && median(values) <= a[1]);
});

test('quantile dots never represent fewer than three guesses each', async () => {
  for (const n of [5, 9, 30, 151, 400]) {
    const dots = quantileDots(Array.from({ length: n }, (_, i) => 1000 + i));
    assert.ok(dots.length <= Math.max(1, Math.floor(n / 3)) && dots.length <= 50);
  }
});

test('sensitivity curves: monotone shapes and a balance point between the medians', async () => {
  const rows = Array.from({ length: 40 }, (_, i) => row(8000 + i * 100, { tooCheapCents: 3000 + i * 50, maxPayCents: 7000 + i * 150 }));
  const s = sensitivityCurves(rows);
  assert.match(s.label, /3-question variant/);
  for (let i = 1; i < s.curves.length; i++) {
    assert.ok(s.curves[i].tooCheap <= s.curves[i - 1].tooCheap);
    assert.ok(s.curves[i].expected >= s.curves[i - 1].expected);
    assert.ok(s.curves[i].tooExpensive >= s.curves[i - 1].tooExpensive);
  }
  assert.ok(s.points.floorCents < s.points.balanceCents && s.points.balanceCents < s.points.ceilingCents);
  assert.ok(sensitivityCurves(rows.slice(0, 4)).suppressed);
});

test('quadrants and crowd accuracy', async () => {
  assert.equal(quadrant(-0.2, 0.1), 'Hidden Gem'); assert.equal(quadrant(-0.2, -0.1), 'Sticker Shock');
  assert.equal(quadrant(0.2, -0.1), 'Overestimated'); assert.equal(quadrant(0.2, 0.1), 'Fair Value');
  const p = productPerception([5000, 9000, 10000, 11000, 20000].map(g => row(g)));
  assert.equal(p.crowd.crowdErrorPct, 0);
  assert.ok(p.crowd.averageIndividualErrorPct > 0.2);
});

test('price twins: correlated bias vectors match, too little overlap does not', async () => {
  assert.ok(similarity({ 1: 0.1, 2: -0.2, 3: 0.3, 4: 0, 5: -0.1 }, { 1: 0.2, 2: -0.1, 3: 0.4, 4: 0.1, 5: 0 }) > 0.99);
  assert.ok(Number.isNaN(similarity({ 1: 0.1, 2: 0.2 }, { 1: 0.1, 2: 0.2 })));
  const twin = priceTwin('a', [
    { id: 'a', name: 'A', vector: { 1: 0.1, 2: -0.2, 3: 0.3, 4: 0, 5: -0.1 } },
    { id: 'b', name: 'Hari', vector: { 1: 0.2, 2: -0.1, 3: 0.4, 4: 0.1, 5: 0 } },
    { id: 'c', name: 'C', vector: { 1: -0.1, 2: 0.2, 3: -0.3, 4: 0, 5: 0.1 } },
  ]);
  assert.deepEqual(twin, { name: 'Hari', match: 1 });
});

test('full report on synthetic data: every published figure carries n and no row-level data leaves', async () => {
  const products = PRODUCTS.map(p => ({ id: p.id, name: p.title, category: p.category, priceCents: Math.round(p.price * 100) }));
  const { responses } = generateSynthetic({ products, respondents: 120, seed: 5 });
  const report = buildReport({ products: products.slice(0, 5), rows: responses.filter(r => products.slice(0, 5).some(p => p.id === r.productId)), personaRows: responses, anchorRows: responses, categories: [...new Set(products.map(p => p.category))] });
  for (const p of report.products) {
    assert.ok(Number.isInteger(p.n));
    if (!p.suppressed) { assert.ok(p.headline.startsWith('Shoppers think')); assert.ok(p.valueGap.n >= 5); }
  }
  const json = JSON.stringify(report);
  assert.ok(!json.includes('seed-5-'), 'respondent ids never appear in a report');
  assert.ok(!json.includes('respondentId'));
});
