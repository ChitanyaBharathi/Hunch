import test from 'node:test';
import assert from 'node:assert/strict';
import { anchoringEffect } from '../server/analytics/anchoring.js';
import { generateSynthetic, ANCHOR_SLOPE } from '../server/seed/synthetic.js';
import { PRODUCTS } from '../server/products.js';

const products = PRODUCTS.map(p => ({ id: p.id, category: p.category, priceCents: Math.round(p.price * 100) }));

test('anchoring regression recovers a planted effect despite the expensive-items confound', () => {
  const { responses } = generateSynthetic({ products, respondents: 300, seed: 41 });
  const a = anchoringEffect(responses);
  assert.ok(!a.suppressed);
  assert.ok(Math.abs(a.slope - ANCHOR_SLOPE) < 0.03, `slope ${a.slope} should be near ${ANCHOR_SLOPE}`);
  assert.ok(a.ci[0] < ANCHOR_SLOPE && ANCHOR_SLOPE < a.ci[1], 'the interval covers the truth');
  assert.ok(a.significant);
  assert.match(a.sentence, /guessed about \d+% higher/);
  assert.ok(Math.abs(a.perDoublingPct - (2 ** a.slope - 1)) < 1e-12);
});

test('no planted effect: the interval covers zero and the sentence says so', () => {
  // Interval coverage checked over 60 seeds was 95%; this seed is one where it covers zero, as 95% of them do.
  const { responses } = generateSynthetic({ products, respondents: 300, seed: 100, anchorSlope: 0 });
  const a = anchoringEffect(responses);
  assert.ok(Math.abs(a.slope) < 3 * a.se);
  assert.ok(a.ci[0] < 0 && a.ci[1] > 0, `ci ${a.ci}`);
  assert.match(a.sentence, /can't yet tell/);
});

test('anchoring is suppressed below 30 responses or 10 respondents', () => {
  const { responses } = generateSynthetic({ products, respondents: 2, seed: 43 });
  assert.ok(anchoringEffect(responses).suppressed);
  assert.ok(anchoringEffect(responses.slice(0, 20)).suppressed);
});
