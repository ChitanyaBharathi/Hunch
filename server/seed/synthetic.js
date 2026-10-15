import { rng } from '../analytics/stats.js';
import { UNBRANDED } from '../brandFrames.js';

// Synthetic respondents for demos and tests. Pure: same seed, same data.
// Planted structure, so the analytics have something true to find:
//   personas  four groups with distinct bias-by-category shapes
//   anchoring guesses rise by ANCHOR_SLOPE × ln(previous price / this price)
//   confound  expensive items are underestimated (what product fixed effects must remove)
//   brand     branded items shown without their brand are guessed lower by BRAND_PREMIUM (log scale)
export const ANCHOR_SLOPE = 0.12;
const LUXURY = new Set(['item_103', 'item_105', 'prod_4', 'prod_3']);
export const brandPremium = id => (LUXURY.has(id) ? 0.45 : 0.15);
export const PLANTED_PERSONAS = {
  'Tech Optimist': { share: 0.25, bias: { Tech: -0.8, Hobbies: -0.4 }, base: 0.05, ages: ['18-24', '25-34'] },
  'Premium Believer': { share: 0.25, bias: { Beauty: 0.6, Fashion: 0.55, Home: 0.2 }, base: 0.02, ages: ['25-34', '35-44'] },
  'Bargain Anchor': { share: 0.25, bias: {}, base: -0.45, ages: ['45-54', '55-64', '35-44'] },
  'Calibrated Shopper': { share: 0.25, bias: {}, base: 0, ages: ['25-34', '35-44', '45-54'] },
};

const normal = random => () => {
  let u = 0, v = 0;
  while (!u) u = random();
  while (!v) v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const pick = (random, list) => list[Math.floor(random() * list.length)];
function shuffle(random, list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
// Ten items covering every category, shuffled: the same dealing rule as real games.
function deal(random, products, count = 10) {
  const pools = shuffle(random, [...new Set(products.map(p => p.category))]).map(c => shuffle(random, products.filter(p => p.category === c)));
  const out = [];
  while (out.length < Math.min(count, products.length)) for (const pool of pools) { if (pool.length && out.length < count) out.push(pool.pop()); }
  return shuffle(random, out);
}

// products: [{ id, category, priceCents }]
export function generateSynthetic({ products, respondents = 300, seed = 2026, days = 60, endDate = new Date(), anchorSlope = ANCHOR_SLOPE, personas = PLANTED_PERSONAS, games: [minGames, maxGames] = [2, 4] }) {
  const random = rng(seed);
  const coin = rng(seed + 999); // own stream: brand arms don't shift the other planted patterns
  const z = normal(random);
  const meanLogPrice = products.reduce((s, p) => s + Math.log(p.priceCents), 0) / products.length;
  // Product-level quirks so products land in different quadrants of the perception map.
  const quirk = new Map(products.map(p => [p.id, { perception: (random() - 0.6) * 0.5, value: (random() - 0.45) * 0.6, fame: random() }]));
  const names = Object.keys(personas);
  const people = [];
  const responses = [];
  for (let i = 0; i < respondents; i++) {
    let roll = random(), persona = names.at(-1);
    for (const name of names) { if ((roll -= personas[name].share) < 0) { persona = name; break; } }
    const spec = personas[persona];
    const id = `seed-${seed}-${String(i).padStart(4, '0')}`;
    const own = Object.fromEntries([...new Set(products.map(p => p.category))].map(c => [c, spec.base + (spec.bias[c] ?? 0) + z() * 0.06]));
    people.push({ id, persona, ageBand: random() < 0.12 ? 'na' : pick(random, spec.ages), gender: pick(random, ['woman', 'man', 'woman', 'man', 'non-binary', 'na']),
      region: pick(random, ['Central', 'East', 'North', 'North-East', 'West']), shopsOnlineFreq: pick(random, ['weekly', 'monthly', 'few-times-a-year', 'rarely']) });
    const games = minGames + Math.floor(random() * (maxGames - minGames + 1));
    for (let g = 0; g < games; g++) {
      const day = new Date(endDate.getTime() - Math.floor(random() * days) * 86400000);
      let previous = null;
      deal(random, products).forEach((product, position) => {
        const q = quirk.get(product.id);
        const noise = 0.18 + (1 - q.fame) * 0.2; // famous items are guessed more precisely
        const frame = UNBRANDED[product.id] && coin() < 0.5 ? 'unbranded' : 'standard';
        const bias = (frame === 'unbranded' ? -brandPremium(product.id) : 0) + own[product.category] + q.perception - 0.08 * (Math.log(product.priceCents) - meanLogPrice)
          + (previous ? anchorSlope * Math.log(previous.priceCents / product.priceCents) : 0) + z() * noise;
        const guessCents = Math.max(10, Math.round(product.priceCents * Math.exp(bias)));
        const maxPay = random() < 0.85 ? (random() < 0.04 ? 0 : Math.max(10, Math.round(product.priceCents * Math.exp(bias + q.value + z() * 0.2)))) : null;
        const tooCheap = random() < 0.75 ? Math.max(5, Math.round(guessCents * Math.exp(-0.65 + z() * 0.2))) : null;
        const ms = Math.round(Math.exp(Math.log(9000) + (1 - q.fame) * 0.6 + z() * 0.45));
        responses.push({ respondentId: id, productId: product.id, category: product.category, roundPosition: position + 1,
          prevPriceCents: previous?.priceCents ?? null, actualCents: product.priceCents, guessCents, maxPayCents: maxPay, tooCheapCents: tooCheap,
          msToAnswer: ms, answeredAt: new Date(day.getTime() + position * 45000).toISOString(), ageBand: people.at(-1).ageBand, isSeed: 1, frame });
        previous = product;
      });
    }
  }
  return { respondents: people, responses };
}
