import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, joinRoom, findRoom } from '../server/game.js';
import { dailyProducts, selectProducts } from '../server/roundSelection.js';
import { freshDb, act, view, priceOf, roundIndex, CONSENT } from './helpers.js';

test('daily challenge: same 5 products for everyone that day, different the next day', () => {
  const db = freshDb();
  const a = createRoom(db, 'Ana', {}, { mode: 'daily' });
  const b = createRoom(db, 'Ben', {}, { mode: 'daily' });
  const ids = code => findRoom(db, code).rounds.map(r => r.productId);
  assert.equal(ids(a.code).length, 5);
  assert.deepEqual(ids(a.code), ids(b.code));
  const catalog = findRoom(db, a.code).rounds.map(r => ({ id: r.productId, category: r.product.category }));
  assert.notDeepEqual(dailyProducts('2026-01-01', catalog, 3), dailyProducts('2026-01-02', catalog, 3));
});

test('daily challenge reveals on guess, is solo, and ends with a price style', () => {
  const db = freshDb();
  const me = createRoom(db, 'Solo', CONSENT, { mode: 'daily' });
  assert.throws(() => joinRoom(db, me.code, 'Friend'), /solo/);
  for (let i = 0; i < 5; i++) {
    act(db, me.code, me, 'guess', { guess: priceOf(db, me.code, i) * 1.5, roundIndex: i });
    const snap = view(db, me.code, me);
    assert.equal(snap.revealed, true);
    assert.equal(snap.mode, 'daily');
    act(db, me.code, me, 'next', { roundIndex: roundIndex(db, me.code) });
  }
  const end = view(db, me.code, me);
  assert.equal(end.finished, true);
  assert.equal(end.priceStyle.key, 'premium');
  assert.equal(end.priceStyle.biasPct, 50);
  assert.equal(db.prepare('SELECT COUNT(*) FROM responses').pluck().get(), 5);
});

test('party games give products in an active study up to a third of the rounds', () => {
  const products = Array.from({ length: 40 }, (_, i) => ({ id: `p${i}`, category: `c${i % 4}` }));
  const picked = selectProducts(10, products, { priorityIds: ['p1', 'p2', 'p3', 'p5', 'p7'] });
  assert.equal(picked.length, 10);
  assert.equal(new Set(picked.map(p => p.id)).size, 10);
  assert.ok(picked.filter(p => ['p1', 'p2', 'p3', 'p5', 'p7'].includes(p.id)).length >= 4);
});

test('reports leave out joke guesses and instant answers, and say how many', async () => {
  const { usable, buildReport } = await import('../server/analytics/report.js');
  const row = (guessCents, msToAnswer) => ({ guessCents, actualCents: 1000, msToAnswer, respondentId: 1, productId: 'x', answeredAt: '2026-01-01' });
  assert.equal(usable(row(1200, 5000)), true);
  assert.equal(usable(row(1200, null)), true);
  assert.equal(usable(row(50, 5000)), false);
  assert.equal(usable(row(20000, 5000)), false);
  assert.equal(usable(row(1200, 400)), false);
  const report = buildReport({ products: [], rows: [row(1200, 5000), row(50, 5000)], categories: [] });
  assert.equal(report.sample.excludedLowQuality, 1);
  assert.equal(report.sample.responses, 1);
});

test('rooms made from the app wait in a lobby: no guesses until the host starts, timing counts from the start', () => {
  const db = freshDb();
  const host = createRoom(db, 'Host', {}, { mode: 'party', lobby: true });
  const guest = joinRoom(db, host.code, 'Guest');
  assert.equal(view(db, host.code, guest).lobby, true);
  assert.throws(() => act(db, host.code, guest, 'guess', { guess: 10, roundIndex: 0 }), /hasn’t started/);
  assert.throws(() => act(db, host.code, guest, 'start', { roundIndex: 0 }), /Only the host/);
  act(db, host.code, host, 'start', { roundIndex: 0 });
  assert.equal(view(db, host.code, guest).lobby, false);
  assert.throws(() => act(db, host.code, host, 'start', { roundIndex: 0 }), /already started/);
  act(db, host.code, guest, 'guess', { guess: 10, roundIndex: 0 });
  assert.ok(findRoom(db, host.code).rounds[0].startedAt);
});

test('brand experiment: unbranded rounds show plain copy, and the analysis recovers the planted brand premium', async () => {
  const { brandEffect } = await import('../server/analytics/brand.js');
  const { generateSynthetic, brandPremium } = await import('../server/seed/synthetic.js');
  const { pricedProducts } = await import('../server/db/catalog.js');
  const db = freshDb();
  const products = pricedProducts(db).filter(p => ['item_105', 'prod_1', 'item_009', 'item_010', 'item_011', 'item_012', 'item_013', 'item_014', 'item_015', 'item_016'].includes(p.id));
  // A 90% interval should contain the planted premium in most datasets, and the estimate should sit close to it.
  let covered = 0, responses;
  for (let seed = 1; seed <= 10; seed++) {
    ({ responses } = generateSynthetic({ products, respondents: 300, seed }));
    for (const id of ['item_105', 'prod_1']) {
      const effect = brandEffect(responses.filter(r => r.productId === id), { reps: 300 });
      const planted = Math.exp(brandPremium(id)) - 1;
      assert.ok(Math.abs(Math.log1p(effect.premiumPct) - brandPremium(id)) < 0.15, `${id} seed ${seed}: ${effect.premiumPct}`);
      if (effect.ci90[0] < planted && planted < effect.ci90[1]) covered++;
    }
  }
  assert.ok(covered >= 15, `interval covered the truth ${covered}/20 times`);
  assert.equal(brandEffect(responses.filter(r => r.productId === 'item_009')), null, 'unbranded items have no experiment');
  // In a game, the unbranded arm hides the brand name.
  db.prepare("UPDATE rounds SET frame = 'unbranded'").run();
  const me = createRoom(db, 'Solo', {}, { mode: 'daily' });
  db.prepare("UPDATE rounds SET product_id = 'item_105', frame = 'unbranded' WHERE round_no = 1").run();
  const shown = view(db, me.code, me).product;
  assert.equal(shown.brand, null);
  assert.ok(!/Rolex|Submariner/.test(shown.title + shown.description));
});
