import test from 'node:test';
import assert from 'node:assert/strict';
import { freshDb } from './helpers.js';
import { pricedProducts } from '../server/db/catalog.js';
import { insertSeed } from '../server/db/seed.js';
import { studyById } from '../server/db/business.js';
import { generateSynthetic } from '../server/seed/synthetic.js';
import { studyReport } from '../server/insightsReport.js';
import { runAnalyst, MAX_STEPS } from '../server/agent/analyst.js';
import { TOOLS, runTool } from '../server/agent/tools.js';

// A real study report built from synthetic respondents; the model is a script, so no network call is made.
async function demoReport() {
  const db = await freshDb();
  const products = await pricedProducts(db);
  const { studyId } = await insertSeed(db, generateSynthetic({ products, respondents: 120, seed: 4 }),
    { study: { company: 'Demo Co', title: 'Demo study', startsOn: '2000-01-01', endsOn: '2999-12-31', productIds: ['prod_1', 'prod_7', 'item_009'] } });
  return studyReport(db, await studyById(db, studyId));
}
const call = (name, args = {}, id) => ({ role: 'model', parts: [{ functionCall: { name, args, ...(id ? { id } : {}) } }] });
const say = text => ({ role: 'model', parts: [{ text }] });

test('analyst runs the tools the model asks for, feeds results back, and returns the answer', async () => {
  const report = await demoReport();
  const script = [call('get_study_overview', {}, 'c1'), call('get_product_insights', { product: 'Sony' }, 'c2'), say('**Shoppers undervalue the headphones.**')];
  const seen = [];
  const events = [];
  const { answer, steps } = await runAnalyst({ report, question: 'Which product is undervalued?', onEvent: e => events.push(e),
    callModel: async ({ contents, tools }) => { seen.push({ contents: structuredClone(contents), tools }); return script.shift(); } });

  assert.equal(answer, '**Shoppers undervalue the headphones.**');
  assert.deepEqual(steps.map(s => s.tool), ['get_study_overview', 'get_product_insights']);
  assert.deepEqual(events.map(e => e.type), ['step', 'step', 'answer']);
  // Each tool result goes back to the model with the call's id, and the product lookup matched by name.
  const reply = seen[2].contents.at(-1).parts[0].functionResponse;
  assert.equal(reply.id, 'c2');
  assert.match(reply.response.result.name, /Sony/);
  assert.ok(reply.response.result.guesses.median.startsWith('S$'));
  // Nothing individual reaches the model: no respondent ids anywhere in what it was sent.
  assert.doesNotMatch(JSON.stringify(seen), /respondentId|respondent_id/);
});

test('analyst stops offering tools on its last step, so it must answer', async () => {
  const report = await demoReport();
  let turns = 0;
  const { answer } = await runAnalyst({ report, question: 'Loop forever',
    callModel: async ({ tools }) => { turns += 1; return tools.length ? call('get_personas') : say('Done.'); } });
  assert.equal(turns, MAX_STEPS);
  assert.equal(answer, 'Done.');
});

test('tools report withheld figures and unknown products instead of making numbers up', async () => {
  const report = await demoReport();
  assert.match(runTool(report, 'get_product_insights', { product: 'a flying car' }).error, /No product matching/);
  assert.match(runTool(report, 'compare_products', { metric: 'vibes' }).error, /Unknown metric/);
  const thin = { ...report, products: [{ id: 'x', name: 'Thin item', category: 'Tech', suppressed: true, n: 2, minimum: 5 }] };
  assert.deepEqual(runTool(thin, 'get_product_insights', { product: 'Thin item' }), { name: 'Thin item', withheld: true, reason: 'Not enough responses: 2 of 5 needed.' });
  const ranked = runTool(report, 'compare_products', { metric: 'perception_gap' }).ranked;
  assert.ok(ranked.length >= 2 && ranked[0].value >= ranked.at(-1).value);
  for (const tool of TOOLS) assert.ok(tool.description && tool.parameters.type === 'object', tool.name);
});
