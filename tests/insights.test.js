import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../server/db/index.js';
import { pricedProducts } from '../server/db/catalog.js';
import { insertSeed, removeSeed, DEMO_EMAIL } from '../server/db/seed.js';
import { createCompany, addCompanyUser, saveStudy } from '../server/db/business.js';
import { generateSynthetic } from '../server/seed/synthetic.js';
import { startServer } from './helpers.js';

test('Insights portal: magic-link sign-in, tenant isolation, aggregates only, access log', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'hunch-'));
  const file = join(dir, 'test.db');
  const db = openDb(file);
  const products = pricedProducts(db);
  const studyProducts = ['prod_1', 'prod_7', 'item_009'];
  const { studyId } = insertSeed(db, generateSynthetic({ products, respondents: 120, seed: 4 }),
    { study: { company: 'Demo Co', title: 'Demo study', startsOn: '2000-01-01', endsOn: '2999-12-31', productIds: studyProducts } });
  const rival = createCompany(db, { name: 'Rival Ltd' });
  addCompanyUser(db, rival, 'rival@example.com');
  const rivalStudy = saveStudy(db, { companyId: rival, title: 'Secret', startsOn: '2000-01-01', endsOn: '2999-12-31', status: 'active', productIds: ['prod_2'] });
  db.close();

  const server = await startServer({ GAME_EPHEMERAL: '0', HUNCH_DB: file, HUNCH_SESSION_SECRET: 's'.repeat(40) });
  const { request } = server;
  const linkFor = email => server.output().match(new RegExp(`for ${email.replace('.', '\\.')}.*token=([a-f0-9]{64})`))?.[1];
  try {
    const unknown = await request('/api/insights/login', { email: 'nobody@example.com' });
    const known = await request('/api/insights/login', { email: DEMO_EMAIL.toUpperCase() });
    assert.equal(unknown.status, 200); assert.deepEqual(unknown.data, known.data, 'no account enumeration');
    await new Promise(r => setTimeout(r, 100));
    assert.equal(linkFor('nobody@example.com'), undefined);
    const token = linkFor(DEMO_EMAIL);
    assert.ok(token, 'link printed to the console');

    assert.equal((await request('/api/insights/studies')).status, 401);
    const signedIn = await request('/api/insights/session', { token });
    assert.equal(signedIn.status, 200); assert.equal(signedIn.data.user.company, 'Demo Co');
    assert.equal((await request('/api/insights/session', { token })).status, 401, 'links work once');
    const session = signedIn.data.session;
    const forged = `${session.split('.')[0]}x.${session.split('.')[1]}`;
    assert.equal((await request('/api/insights/studies', undefined, forged)).status, 401);

    const studies = await request('/api/insights/studies', undefined, session);
    assert.deepEqual(studies.data.map(s => s.title), ['Demo study']);
    assert.ok(studies.data[0].responses > 30);

    const report = await request(`/api/insights/studies/${studyId}/report`, undefined, session);
    assert.equal(report.status, 200);
    assert.deepEqual(report.data.products.map(p => p.id).sort(), [...studyProducts].sort());
    assert.ok(report.data.sample.includesSyntheticData);
    assert.ok(report.data.products.every(p => p.suppressed || (p.n >= 5 && p.headline)));
    assert.ok(report.data.map.length > 0);
    const text = JSON.stringify(report.data);
    assert.ok(!text.includes('respondentId') && !/[0-9a-f]{8}-[0-9a-f]{4}-/.test(text), 'no respondent ids or rows');

    assert.equal((await request(`/api/insights/studies/${rivalStudy}/report`, undefined, session)).status, 404, 'other companies’ studies are invisible');
    const csv = await request(`/api/insights/studies/${studyId}/report.csv`, undefined, session);
    assert.equal(csv.status, 200); assert.match(csv.headers.get('content-type'), /text\/csv/);
    assert.ok(csv.data.startsWith('"section"'));

    const check = openDb(file);
    const log = check.prepare('SELECT exported FROM report_access_log ORDER BY id').pluck().all();
    assert.deepEqual(log, [0, 1]);
    assert.equal(check.prepare('SELECT magic_link_token_hash FROM company_users WHERE email = ?').pluck().get(DEMO_EMAIL), null);
    assert.ok(removeSeed(check).responses > 0);
    assert.equal(check.prepare('SELECT COUNT(*) FROM companies').pluck().get(), 1, 'only the real company remains');
    check.close();
  } finally {
    await server.stop();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Insights sign-in requests are rate-limited per email', async () => {
  const server = await startServer();
  try {
    let status = 0;
    for (let i = 0; i < 6; i++) status = (await server.request('/api/insights/login', { email: 'someone@example.com' })).status;
    assert.equal(status, 429);
  } finally { await server.stop(); }
});
