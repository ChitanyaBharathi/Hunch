import test from 'node:test';
import assert from 'node:assert/strict';
import { kmeans, chooseK, silhouette, nameCentroid, buildPersonas, respondentVectors } from '../server/analytics/personas.js';
import { generateSynthetic, PLANTED_PERSONAS } from '../server/seed/synthetic.js';
import { rng } from '../server/analytics/stats.js';
import { PRODUCTS } from '../server/products.js';

const categories = [...new Set(PRODUCTS.map(p => p.category))];
const products = PRODUCTS.map(p => ({ id: p.id, category: p.category, priceCents: Math.round(p.price * 100) }));

test('k-means and silhouette find well-separated known groups', async () => {
  const random = rng(9);
  const centres = [[0, 0], [5, 5], [0, 5]];
  const points = centres.flatMap(c => Array.from({ length: 30 }, () => [c[0] + random() - 0.5, c[1] + random() - 0.5]));
  const fit = kmeans(points, 3);
  for (let g = 0; g < 3; g++) assert.equal(new Set(fit.assignments.slice(g * 30, g * 30 + 30)).size, 1, 'each planted group lands in one cluster');
  assert.ok(silhouette(points, fit.assignments, 3) > 0.8);
  assert.equal(chooseK(points, { kMin: 2, kMax: 5 }).k, 3);
});

test('personas recover the planted groups in synthetic respondents and are named from their shape', async () => {
  const { respondents, responses } = generateSynthetic({ products, respondents: 300, seed: 17 });
  const fit = buildPersonas(responses, categories);
  assert.ok(!fit.suppressed);
  assert.equal(fit.k, 4, `expected 4 clusters, got ${fit.k}`);
  // Purity: the share of respondents whose cluster's majority planted persona matches their own.
  const truth = new Map(respondents.map(r => [r.id, r.persona]));
  let agree = 0;
  for (const p of fit.personas) {
    const members = [...fit.membership].filter(([, c]) => c === p.cluster).map(([id]) => truth.get(id));
    const counts = members.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map());
    agree += Math.max(...counts.values());
  }
  assert.ok(agree / fit.membership.size > 0.9, `purity ${agree / fit.membership.size}`);
  const names = fit.personas.map(p => p.name).sort();
  assert.deepEqual(names, Object.keys(PLANTED_PERSONAS).sort());
  assert.ok(fit.personas.every(p => p.reported && p.size >= 10));
});

test('naming rules', async () => {
  const zeros = categories.map(() => 0);
  assert.equal(nameCentroid(zeros, categories).name, 'Calibrated Shopper');
  assert.equal(nameCentroid(categories.map(() => -0.4), categories).name, 'Bargain Anchor');
  assert.equal(nameCentroid(categories.map(c => (c === 'Tech' ? -1 : 0)), categories).name, 'Tech Optimist');
  assert.equal(nameCentroid(categories.map(c => (c === 'Beauty' || c === 'Fashion' ? 0.6 : 0)), categories).name, 'Premium Believer');
  assert.notEqual(nameCentroid(zeros, categories, new Set(['Calibrated Shopper'])).name, 'Calibrated Shopper');
});

test('too few eligible respondents: personas are suppressed, not guessed', async () => {
  const { responses } = generateSynthetic({ products, respondents: 20, seed: 3 });
  assert.ok(respondentVectors(responses, categories).length <= 20);
  assert.ok(buildPersonas(responses, categories).suppressed);
});
