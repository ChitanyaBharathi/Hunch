import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { PRODUCTS } from '../server/products.js';
import { selectProducts, ROUNDS_PER_GAME } from '../server/roundSelection.js';
import { createRoom } from '../server/game.js';
import { pricedProducts, seedCatalog } from '../server/db/catalog.js';
import { freshDb, view } from './helpers.js';

test('seed catalog covers nine categories, every item has a picture, and benchmark metadata is honest', async () => {
  assert.equal(PRODUCTS.length, 151);
  assert.equal(new Set(PRODUCTS.map(p => p.id)).size, PRODUCTS.length);
  const categories = [...new Set(PRODUCTS.map(p => p.category))];
  assert.equal(categories.length, 9);
  for (const category of categories) assert.ok(PRODUCTS.filter(p => p.category === category).length >= 10);
  for (const p of PRODUCTS) {
    assert.ok(Number.isFinite(p.price) && p.price > 0);
    assert.ok(p.title && p.description && p.emoji);
    if (p.imageUrl) assert.ok(existsSync(new URL(`../public${p.imageUrl}`, import.meta.url)), `missing photo for ${p.id}`);
    assert.equal(p.currency, 'SGD');
    assert.equal(p.cohortInsights, undefined);
  }
});

test('database catalog is seeded with categories, products and dated demo prices', async () => {
  const db = await freshDb();
  assert.equal(await db.prepare('SELECT COUNT(*) FROM categories').pluck().get(), 9);
  const priced = await pricedProducts(db);
  assert.equal(priced.length, 151);
  assert.ok(priced.every(p => Number.isInteger(p.priceCents) && p.priceCents > 0 && p.sourceUrl === null));
  assert.equal(priced.find(p => p.id === 'prod_1').priceCents, 49900);
});

test('the reveal price is the latest observation on or before the game date', async () => {
  const db = await freshDb();
  await db.prepare("INSERT INTO product_prices (product_id, price_cents, observed_on) VALUES ('prod_1', 52900, '2026-06-01')").run();
  await db.prepare("INSERT INTO product_prices (product_id, price_cents, observed_on) VALUES ('prod_1', 99900, '2099-01-01')").run();
  const at = async date => (await pricedProducts(db, date)).find(p => p.id === 'prod_1').priceCents;
  assert.equal(await at('2026-05-31'), 49900); assert.equal(await at('2026-06-01'), 52900); assert.equal(await at('2027-01-01'), 52900);
});

test('ten-round selections have no repeats and spread across nine categories', async () => {
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

test('inactive products are never dealt and room views never leak prices', async () => {
  const db = await freshDb();
  await db.prepare("UPDATE products SET is_active = 0 WHERE id = 'prod_1'").run();
  for (let i = 0; i < 10; i++) {
    const { code, token, player } = await createRoom(db, `Host ${i}`);
    assert.ok(!(await db.prepare('SELECT product_id FROM rounds JOIN rooms ON rooms.id = rounds.room_id WHERE code = ?').pluck().all(code)).includes('prod_1'));
    const snap = await view(db, code, { token, player });
    assert.equal(snap.totalRounds, 10); assert.equal(snap.actualPrice, null);
    assert.equal(snap.product.benchmarkStatus, 'demo'); assert.equal(snap.product.price, undefined);
  }
});

test('reopening a database adds new catalog items without touching edited ones', async () => {
  const db = await freshDb();
  await db.prepare("UPDATE products SET name = 'Edited by admin' WHERE id = 'prod_1'").run();
  await db.prepare("DELETE FROM product_prices WHERE product_id = 'item_150'").run();
  await db.prepare("DELETE FROM products WHERE id = 'item_150'").run();
  await seedCatalog(db);
  assert.equal(await db.prepare("SELECT name FROM products WHERE id = 'prod_1'").pluck().get(), 'Edited by admin');
  assert.equal((await pricedProducts(db)).length, 151);
  assert.ok(await db.prepare("SELECT emoji FROM products WHERE id = 'item_150'").pluck().get());
});
