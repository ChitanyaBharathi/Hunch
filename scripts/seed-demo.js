// Demo data for Hunch Insights, before real responses exist.
//   node scripts/seed-demo.js          add ~300 synthetic respondents (planted personas + anchoring) and a demo study
//   node scripts/seed-demo.js --remove delete every seeded row (real data is untouched)
// Seeded rows are flagged is_seed = 1 and reports say "includes synthetic demo data" while any contribute.
import '../server/env.js';
import { openDb, DEFAULT_DB_FILE } from '../server/db/index.js';
import { pricedProducts, today } from '../server/db/catalog.js';
import { insertSeed, removeSeed, seedCount, DEMO_EMAIL } from '../server/db/seed.js';
import { generateSynthetic } from '../server/seed/synthetic.js';

const db = openDb(process.env.HUNCH_DB || DEFAULT_DB_FILE);
if (process.argv.includes('--remove')) {
  console.log('Removed synthetic demo data:', removeSeed(db));
} else if (seedCount(db)) {
  console.log('Synthetic demo data is already loaded. Run with --remove first to regenerate.');
} else {
  const catalog = pricedProducts(db);
  const wanted = ['prod_1', 'prod_7', 'item_009', 'item_028', 'prod_6'].filter(id => catalog.some(p => p.id === id));
  // Games draw from a 24-item pool that includes the study's items, as real games give study items priority.
  const others = catalog.filter(p => !wanted.includes(p.id)).sort((a, b) => (a.id < b.id ? -1 : 1)).filter((_, i) => i % 7 === 0).slice(0, 24 - wanted.length);
  const products = [...catalog.filter(p => wanted.includes(p.id)), ...others];
  const end = new Date();
  const start = new Date(end.getTime() - 60 * 86400000).toISOString().slice(0, 10);
  const data = generateSynthetic({ products, respondents: 300, seed: 17, days: 60, endDate: end });
  const result = insertSeed(db, data, { study: { company: 'Demo Audio & Coffee Co. (synthetic)', title: 'Q4 price perception: audio and coffee', startsOn: start, endsOn: today(), productIds: wanted } });
  console.log('Added synthetic demo data:', result);
  console.log(`Sign in to /insights as ${DEMO_EMAIL}; the sign-in link prints in the game server console.`);
}
db.close();
