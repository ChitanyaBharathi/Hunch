import { randomBytes } from 'node:crypto';
import { PRODUCTS } from '../products.js';

// Prices seeded from the original catalog are demo benchmarks, dated before the first game was played.
export const DEMO_PRICE_DATE = '2026-01-01';
const BRANDS = { prod_1: 'Sony', prod_2: 'Lululemon', prod_3: 'Dyson', prod_4: 'Aesop', prod_5: 'Apple', prod_6: 'Keychron', prod_7: 'Nespresso', prod_8: 'On' };
export const today = () => new Date().toISOString().slice(0, 10);

// Adds catalog items the database doesn't have yet, and refreshes their pictures.
// Names, descriptions and prices of existing items are left alone: admins may have edited them.
// One read, then writes only for what is missing or changed, so a cold start costs a single query.
// Items deliberately rewritten in code. Applied only while the database still holds the old title, so admin edits survive.
const RENAMED = { item_075: 'Concert ticket, mid-tier seat' };
// Items taken out of the game. Their rows stay so old games and research still resolve; they are just never dealt.
export const RETIRED = ['prod_2'];

export async function seedCatalog(db, products = PRODUCTS) {
  for (const [id, oldTitle] of Object.entries(RENAMED)) {
    const p = products.find(item => item.id === id);
    if (p) await db.prepare('UPDATE products SET name = ?, brand = ?, description = ? WHERE id = ? AND name = ?').run(p.title, p.brand ?? null, p.description, id, oldTitle);
  }
  const existing = new Map((await db.prepare('SELECT id, image_url AS imageUrl, emoji, is_active AS isActive FROM products').all()).map(r => [r.id, r]));
  const retire = RETIRED.filter(id => existing.get(id)?.isActive);
  for (const id of retire) await db.prepare('UPDATE products SET is_active = 0 WHERE id = ?').run(id);
  const missing = products.filter(p => !existing.has(p.id));
  const changed = products.filter(p => existing.has(p.id) && ((existing.get(p.id).imageUrl ?? null) !== (p.imageUrl ?? null) || (existing.get(p.id).emoji ?? null) !== (p.emoji ?? null)));
  if (!missing.length && !changed.length) return;
  await db.transaction(async () => {
    for (const p of changed) await db.prepare('UPDATE products SET image_url = ?, emoji = ? WHERE id = ?').run(p.imageUrl ?? null, p.emoji ?? null, p.id);
    for (const p of missing) {
      const { id: categoryId } = await db.prepare('INSERT INTO categories (name) VALUES (?) ON CONFLICT (name) DO UPDATE SET name = excluded.name RETURNING id').get(p.category);
      await db.prepare('INSERT INTO products (id, name, brand, category_id, image_url, description, emoji, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(p.id, p.title, p.brand ?? BRANDS[p.id] ?? null, categoryId, p.imageUrl ?? null, p.description, p.emoji ?? null, RETIRED.includes(p.id) ? 0 : 1);
      await db.prepare('INSERT INTO product_prices (product_id, price_cents, currency, retailer, source_url, observed_on) VALUES (?, ?, ?, ?, NULL, ?)')
        .run(p.id, Math.round(p.price * 100), p.currency ?? 'SGD', 'Demo benchmark', DEMO_PRICE_DATE);
    }
  })();
}

// The price shown at reveal: the latest observation on or before the game date.
const LATEST_PRICE = `SELECT pp.id FROM product_prices pp WHERE pp.product_id = p.id AND pp.observed_on <= @onDate
  ORDER BY pp.observed_on DESC, pp.id DESC LIMIT 1`;
const PRODUCT_COLUMNS = `p.id, p.name, p.brand, c.name AS category, p.image_url AS imageUrl, p.emoji, p.description, p.unit_size AS unitSize,
  p.is_active AS isActive, p.sponsor_study_id AS sponsorStudyId, pp.id AS priceId, pp.price_cents AS priceCents,
  pp.retailer, pp.source_url AS sourceUrl, pp.observed_on AS observedOn`;

// Only active items by default, because these are what games deal. `includeRetired` is for reading back old games.
export async function pricedProducts(db, onDate = today(), { includeRetired = false } = {}) {
  return db.prepare(`SELECT ${PRODUCT_COLUMNS} FROM products p JOIN categories c ON c.id = p.category_id
    JOIN product_prices pp ON pp.id = (${LATEST_PRICE}) ${includeRetired ? '' : 'WHERE p.is_active = 1 '}ORDER BY p.id`).all({ onDate });
}

export async function productsById(db, ids, onDate = today()) {
  if (!ids.length) return [];
  return db.prepare(`SELECT ${PRODUCT_COLUMNS} FROM products p JOIN categories c ON c.id = p.category_id
    LEFT JOIN product_prices pp ON pp.id = (${LATEST_PRICE}) WHERE p.id IN (SELECT json_array_elements_text(@ids::json)) ORDER BY p.name`)
    .all({ onDate, ids: JSON.stringify(ids) });
}

export const categories = db => db.prepare('SELECT id, name FROM categories ORDER BY id').all();

// ── Admin ────────────────────────────────────────────────────────────────────
export async function allProducts(db) {
  return db.prepare(`SELECT ${PRODUCT_COLUMNS} FROM products p JOIN categories c ON c.id = p.category_id
    LEFT JOIN product_prices pp ON pp.id = (${LATEST_PRICE}) ORDER BY c.id, p.name`).all({ onDate: '9999-12-31' });
}

export async function priceHistory(db, productId) {
  return db.prepare(`SELECT id, price_cents AS priceCents, currency, retailer, source_url AS sourceUrl, observed_on AS observedOn
    FROM product_prices WHERE product_id = ? ORDER BY observed_on DESC, id DESC`).all(productId);
}

export async function saveProduct(db, { id, name, brand, category, imageUrl, description, unitSize, isActive = true, sponsorStudyId = null }) {
  const categoryId = (await db.prepare('INSERT INTO categories (name) VALUES (?) ON CONFLICT (name) DO UPDATE SET name = excluded.name RETURNING id').get(category)).id;
  const productId = id || `prd_${randomBytes(4).toString('hex')}`;
  await db.prepare(`INSERT INTO products (id, name, brand, category_id, image_url, description, unit_size, is_active, sponsor_study_id)
    VALUES (@productId, @name, @brand, @categoryId, @imageUrl, @description, @unitSize, @isActive, @sponsorStudyId)
    ON CONFLICT (id) DO UPDATE SET name = excluded.name, brand = excluded.brand, category_id = excluded.category_id, image_url = excluded.image_url,
      description = excluded.description, unit_size = excluded.unit_size, is_active = excluded.is_active, sponsor_study_id = excluded.sponsor_study_id`)
    .run({ productId, name, brand: brand || null, categoryId, imageUrl: imageUrl || null, description: description || null, unitSize: unitSize || null, isActive: isActive ? 1 : 0, sponsorStudyId: sponsorStudyId || null });
  return productId;
}

export async function addPrice(db, { productId, priceCents, currency = 'SGD', retailer, sourceUrl, observedOn }) {
  return (await db.prepare(`INSERT INTO product_prices (product_id, price_cents, currency, retailer, source_url, observed_on) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(productId, priceCents, currency, retailer || null, sourceUrl || null, observedOn)).lastInsertRowid;
}

export const productExists = async (db, id) => Boolean(await db.prepare('SELECT 1 FROM products WHERE id = ?').get(id));
