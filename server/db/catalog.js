import { randomBytes } from 'node:crypto';
import { PRODUCTS } from '../products.js';

// Prices seeded from the original catalog are demo benchmarks, dated before the first game was played.
export const DEMO_PRICE_DATE = '2026-01-01';
const BRANDS = { prod_1: 'Sony', prod_2: 'Lululemon', prod_3: 'Dyson', prod_4: 'Aesop', prod_5: 'Apple', prod_6: 'Keychron', prod_7: 'Nespresso', prod_8: 'On' };
export const today = () => new Date().toISOString().slice(0, 10);

// Adds catalog items the database doesn't have yet, and refreshes their pictures.
// Names, descriptions and prices of existing items are left alone: admins may have edited them.
export function seedCatalog(db, products = PRODUCTS) {
  const category = db.prepare('INSERT INTO categories (name) VALUES (?) ON CONFLICT (name) DO UPDATE SET name = excluded.name RETURNING id');
  const exists = db.prepare('SELECT 1 FROM products WHERE id = ?').pluck();
  const product = db.prepare('INSERT INTO products (id, name, brand, category_id, image_url, description, emoji) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const picture = db.prepare('UPDATE products SET image_url = ?, emoji = ? WHERE id = ?');
  const price = db.prepare('INSERT INTO product_prices (product_id, price_cents, currency, retailer, source_url, observed_on) VALUES (?, ?, ?, ?, NULL, ?)');
  db.transaction(() => {
    for (const p of products) {
      if (exists.get(p.id)) { picture.run(p.imageUrl ?? null, p.emoji ?? null, p.id); continue; }
      const { id: categoryId } = category.get(p.category);
      product.run(p.id, p.title, p.brand ?? BRANDS[p.id] ?? null, categoryId, p.imageUrl ?? null, p.description, p.emoji ?? null);
      price.run(p.id, Math.round(p.price * 100), p.currency ?? 'SGD', 'Demo benchmark', DEMO_PRICE_DATE);
    }
  })();
}

// The price shown at reveal: the latest observation on or before the game date.
const LATEST_PRICE = `SELECT pp.id FROM product_prices pp WHERE pp.product_id = p.id AND pp.observed_on <= @onDate
  ORDER BY pp.observed_on DESC, pp.id DESC LIMIT 1`;
const PRODUCT_COLUMNS = `p.id, p.name, p.brand, c.name AS category, p.image_url AS imageUrl, p.emoji, p.description, p.unit_size AS unitSize,
  p.is_active AS isActive, p.sponsor_study_id AS sponsorStudyId, pp.id AS priceId, pp.price_cents AS priceCents,
  pp.retailer, pp.source_url AS sourceUrl, pp.observed_on AS observedOn`;

export function pricedProducts(db, onDate = today()) {
  return db.prepare(`SELECT ${PRODUCT_COLUMNS} FROM products p JOIN categories c ON c.id = p.category_id
    JOIN product_prices pp ON pp.id = (${LATEST_PRICE}) WHERE p.is_active = 1 ORDER BY p.id`).all({ onDate });
}

export function productsById(db, ids, onDate = today()) {
  if (!ids.length) return [];
  return db.prepare(`SELECT ${PRODUCT_COLUMNS} FROM products p JOIN categories c ON c.id = p.category_id
    LEFT JOIN product_prices pp ON pp.id = (${LATEST_PRICE}) WHERE p.id IN (SELECT value FROM json_each(@ids)) ORDER BY p.name`)
    .all({ onDate, ids: JSON.stringify(ids) });
}

export const categories = db => db.prepare('SELECT id, name FROM categories ORDER BY id').all();

// ── Admin ────────────────────────────────────────────────────────────────────
export function allProducts(db) {
  return db.prepare(`SELECT ${PRODUCT_COLUMNS} FROM products p JOIN categories c ON c.id = p.category_id
    LEFT JOIN product_prices pp ON pp.id = (${LATEST_PRICE}) ORDER BY c.id, p.name`).all({ onDate: '9999-12-31' });
}

export function priceHistory(db, productId) {
  return db.prepare(`SELECT id, price_cents AS priceCents, currency, retailer, source_url AS sourceUrl, observed_on AS observedOn
    FROM product_prices WHERE product_id = ? ORDER BY observed_on DESC, id DESC`).all(productId);
}

export function saveProduct(db, { id, name, brand, category, imageUrl, description, unitSize, isActive = true, sponsorStudyId = null }) {
  const categoryId = db.prepare('INSERT INTO categories (name) VALUES (?) ON CONFLICT (name) DO UPDATE SET name = excluded.name RETURNING id').get(category).id;
  const productId = id || `prd_${randomBytes(4).toString('hex')}`;
  db.prepare(`INSERT INTO products (id, name, brand, category_id, image_url, description, unit_size, is_active, sponsor_study_id)
    VALUES (@productId, @name, @brand, @categoryId, @imageUrl, @description, @unitSize, @isActive, @sponsorStudyId)
    ON CONFLICT (id) DO UPDATE SET name = excluded.name, brand = excluded.brand, category_id = excluded.category_id, image_url = excluded.image_url,
      description = excluded.description, unit_size = excluded.unit_size, is_active = excluded.is_active, sponsor_study_id = excluded.sponsor_study_id`)
    .run({ productId, name, brand: brand || null, categoryId, imageUrl: imageUrl || null, description: description || null, unitSize: unitSize || null, isActive: isActive ? 1 : 0, sponsorStudyId: sponsorStudyId || null });
  return productId;
}

export function addPrice(db, { productId, priceCents, currency = 'SGD', retailer, sourceUrl, observedOn }) {
  return db.prepare(`INSERT INTO product_prices (product_id, price_cents, currency, retailer, source_url, observed_on) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(productId, priceCents, currency, retailer || null, sourceUrl || null, observedOn).lastInsertRowid;
}

export const productExists = (db, id) => Boolean(db.prepare('SELECT 1 FROM products WHERE id = ?').get(id));
