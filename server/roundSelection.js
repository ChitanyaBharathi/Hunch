import { randomInt, createHash } from 'node:crypto';
import { PRODUCTS } from './products.js';

export const ROUNDS_PER_GAME = 10;
export const DAILY_ROUNDS = 5;

function shuffle(values, rand = randomInt) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function spreadAcrossCategories(products, count, rand) {
  const categories = shuffle([...new Set(products.map(product => product.category))], rand);
  const pools = categories.map(category => shuffle(products.filter(product => product.category === category), rand));
  const selected = [];
  while (selected.length < Math.min(count, products.length)) {
    for (const pool of pools) {
      if (pool.length) selected.push(pool.pop());
      if (selected.length === Math.min(count, products.length)) break;
    }
  }
  return selected;
}

// `products` defaults to the seed catalog; the server passes the active, priced products from the database.
// Products in an active client study (`priorityIds`) fill up to a third of the game, so studies reach their targets.
export function selectProducts(count = ROUNDS_PER_GAME, products = PRODUCTS, { priorityIds = [] } = {}) {
  const wanted = new Set(priorityIds);
  const priority = shuffle(products.filter(p => wanted.has(p.id))).slice(0, Math.ceil(count / 3));
  const rest = spreadAcrossCategories(products.filter(p => !priority.includes(p)), count - priority.length, randomInt);
  return shuffle([...priority, ...rest]);
}

// The same products, in the same order, for everyone on a given date.
export function dailyProducts(date, products = PRODUCTS, count = DAILY_ROUNDS) {
  let counter = 0;
  const rand = n => createHash('sha256').update(`hunch-daily:${date}:${counter++}`).digest().readUInt32BE(0) % n;
  const sorted = [...products].sort((a, b) => (a.id < b.id ? -1 : 1));
  return shuffle(spreadAcrossCategories(sorted, count, rand), rand);
}
