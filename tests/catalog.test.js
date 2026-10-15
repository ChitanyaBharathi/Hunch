import test from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCTS } from '../server/products.js';
import { selectProducts, ROUNDS_PER_GAME } from '../server/roundSelection.js';
import { createRoom } from '../server/game.js';
import { pricedProducts, seedCatalog } from '../server/db/catalog.js';
import { freshDb, view } from './helpers.js';

test('seed catalog covers nine categories, every item has a picture, and benchmark metadata is honest', () => {
  assert.equal(PRODUCTS.length, 151);
  assert.equal(new Set(PRODUCTS.map(p => p.id)).size, PRODUCTS.length);
  const categories = [...new Set(PRODUCTS.map(p => p.category))];
  assert.equal(categories.length, 9);
  for (const category of categories) assert.ok(PRODUCTS.filter(p => p.category === category).length >= 10);
  for (const p of PRODUCTS) {
    assert.ok(Number.isFinite(p.price) && p.price > 0);
    assert.ok(p.title && p.description && p.emoji);
    if (p.imageUrl) assert.ok(new URL(p.imageUrl));
    assert.equal(p.currency, 'SGD');
    assert.equal(p.cohortInsights, undefined);
  }
});

test('database catalog is seeded with categories, products and dated demo prices', () => {
  const db = freshDb();
  assert.equal(db.prepare('SELECT COUNT(*) FROM categories').pluck().get(), 9);
  const priced = pricedProducts(db);
  assert.equal(priced.length, 151);
  assert.ok(priced.every(p => Number.isInteger(p.priceCents) && p.priceCents > 0 && p.sourceUrl === null));
  assert.equal(priced.find(p => p.id === 'prod_1').priceCents, 49900);
});

test('the reveal price is the latest observation on or before the game date', () => {
  const db = freshDb();
  db.prepare("INSERT INTO product_prices (product_id, price_cents, observed_on) VALUES ('prod_1', 52900, '2026-06-01')").run();
  db.prepare("INSERT INTO product_prices (product_id, price_cents, observed_on) VALUES ('prod_1', 99900, '2099-01-01')").run();
  const at = date => pricedProducts(db, date).find(p => p.id === 'prod_1').priceCents;
  assert.equal(at('2026-05-31'), 49900); assert.equal(at('2026-06-01'), 52900); assert.equal(at('2027-01-01'), 52900);
});

test('ten-round selections have no repeats and spread across nine categories', () => {
  for (let i = 0; i < 20; i++) {
    const selection = selectProducts();
    assert.equal(selection.length, ROUNDS_PER_GAME);
    assert.equal(new Set(selection.map(p => p.id)).size, selection.length);
    assert.equal(new Set(selection.map(p => p.category)).size, 9);
  }
  const all = selectProducts(1000);
  assert.equal(all.length, PRODUCTS.length);
  assert.equal(new Set(all.map(p => p.id)).size, PRODUCTS.length);
});

test('inactive products are never dealt and room views never leak prices', () => {
  const db = freshDb();
  db.prepare("UPDATE products SET is_active = 0 WHERE id = 'prod_1'").run();
  for (let i = 0; i < 10; i++) {
    const { code, token, player } = createRoom(db, `Host ${i}`);
    assert.ok(!db.prepare('SELECT product_id FROM rounds JOIN rooms ON rooms.id = rounds.room_id WHERE code = ?').pluck().all(code).includes('prod_1'));
    const snap = view(db, code, { token, player });
    assert.equal(snap.totalRounds, 10); assert.equal(snap.actualPrice, null);
    assert.equal(snap.product.benchmarkStatus, 'demo'); assert.equal(snap.product.price, undefined);
  }
});

test('reopening a database adds new catalog items without touching edited ones', () => {
  const db = freshDb();
  db.prepare("UPDATE products SET name = 'Edited by admin' WHERE id = 'prod_1'").run();
  db.prepare("DELETE FROM product_prices WHERE product_id = 'item_150'").run();
  db.prepare("DELETE FROM products WHERE id = 'item_150'").run();
  seedCatalog(db);
  assert.equal(db.prepare("SELECT name FROM products WHERE id = 'prod_1'").pluck().get(), 'Edited by admin');
  assert.equal(pricedProducts(db).length, 151);
  assert.ok(db.prepare("SELECT emoji FROM products WHERE id = 'item_150'").pluck().get());
});
