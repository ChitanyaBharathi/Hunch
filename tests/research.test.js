import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, joinRoom, findRoom } from '../server/game.js';
import { roomReport, reportCsv } from '../server/insightsReport.js';
import { responses } from '../server/db/research.js';
import { CONSENT, act, view, playRound, roundIndex } from './helpers.js';
import { freshDb } from './helpers.js';

async function researchRoom(n = 5, research = CONSENT) {
  const db = await freshDb();
  const host = await createRoom(db, 'Host', research);
  const players = [host];
  for (let i = 0; i < n - 1; i++) players.push(await joinRoom(db, host.code, `Player ${i}`, research));
  return { db, code: host.code, host, players };
}
const count = async (db, table) => db.prepare(`SELECT COUNT(*) FROM ${table}`).pluck().get();

test('research rows are written only at reveal, only for consented players, and carry no identity', async () => {
  const { db, code, host, players } = await researchRoom(5);
  const outsider = await joinRoom(db, code, 'Not opted in');
  const price = await playRound(db, code, host, [...players, outsider], (p, i) => p * (0.8 + i * 0.1), () => ({ maximumPay: 1, tooCheap: 0.5 }));
  assert.equal(await count(db, 'responses'), 5, 'outsider excluded');
  const rows = await db.prepare('SELECT * FROM responses').all();
  assert.ok(rows.every(r => r.round_position === 1 && r.prev_product_price_cents === null && r.actual_price_cents === Math.round(price * 100)));
  const text = JSON.stringify(rows);
  for (const secret of [code, 'Host', 'Player 0', host.token, host.player.id]) assert.ok(!text.includes(secret));
  // Unconsented players' optional answers are not even stored in the game tables.
  assert.equal(await db.prepare('SELECT max_pay_cents FROM guesses WHERE player_id = ?').pluck().get(outsider.player.id), null);
  // Second round: guesses alone write nothing; the reveal does, with the previous price for anchoring.
  await act(db, code, host, 'next', { roundIndex: 0 });
  for (const p of players) await act(db, code, p, 'guess', { roundIndex: 1, guess: 10 });
  assert.equal(await count(db, 'responses'), 5);
  await act(db, code, host, 'reveal', { roundIndex: 1 });
  assert.equal(await db.prepare('SELECT prev_product_price_cents FROM responses WHERE round_position = 2').pluck().get(), Math.round(price * 100));
});

test('consent must be active both when guessing and at reveal', async () => {
  const { db, code, host, players } = await researchRoom(5);
  const late = await joinRoom(db, code, 'Late opt-in');
  const index = await roundIndex(db, code);
  for (const p of [...players, late]) await act(db, code, p, 'guess', { roundIndex: index, guess: 50 });
  await act(db, code, late, 'consent', { researchConsent: true, ageConfirmed: true }); // after guessing
  await act(db, code, players[1], 'consent', { researchConsent: false });              // withdrew before reveal
  await act(db, code, host, 'reveal', { roundIndex: index });
  assert.equal(await count(db, 'responses'), 4);
});

test('withdrawal deletes the respondent\'s responses and link, and reports drop them on next refresh', async () => {
  const { db, code, host, players } = await researchRoom(6);
  const earlier = new Date(Date.now() - 10_000).toISOString(); // answers below 1.5 s are left out of reports as "didn't look"
  await db.prepare('UPDATE rounds SET started_at = ? WHERE started_at IS NOT NULL').run(earlier);
  await db.prepare('UPDATE players SET joined_at = ?').run(earlier);
  await db.prepare("UPDATE rounds SET frame = 'standard'").run(); // the brand experiment would split this product's answers
  await playRound(db, code, host, players, p => p * 0.9, p => ({ maximumPay: p }));
  const room = await findRoom(db, code);
  const before = await roomReport(db, room);
  assert.equal(before.products[0].n, 6);
  assert.equal((await responses(db)).length, 6);
  await act(db, code, players[2], 'profile', { ageBand: '25-34', gender: 'na', region: 'East', shopsOnlineFreq: 'weekly' });
  const respondentId = await db.prepare('SELECT respondent_id FROM player_respondent_link WHERE player_id = ?').pluck().get(players[2].player.id);
  assert.equal(await db.prepare('SELECT age_band FROM respondents WHERE id = ?').pluck().get(respondentId), '25-34');

  await act(db, code, players[2], 'consent', { researchConsent: false });
  assert.equal(await db.prepare('SELECT COUNT(*) FROM responses WHERE respondent_id = ?').pluck().get(respondentId), 0);
  assert.equal(await db.prepare('SELECT COUNT(*) FROM player_respondent_link WHERE respondent_id = ?').pluck().get(respondentId), 0);
  const audit = await db.prepare('SELECT * FROM respondents WHERE id = ?').get(respondentId);
  assert.equal(audit.age_band, null); assert.equal(audit.key_hash, null);
  assert.ok(await db.prepare('SELECT withdrawn_at FROM consents WHERE respondent_id = ?').pluck().get(respondentId));
  assert.equal((await responses(db)).length, 5);
  assert.equal((await roomReport(db, await findRoom(db, code))).products[0].n, 5);
  assert.equal((await view(db, code, players[2])).research.status, 'none');
  // Dropping to 4 suppresses the product entirely.
  await act(db, code, players[3], 'consent', { researchConsent: false });
  const after = await roomReport(db, await findRoom(db, code));
  assert.ok(after.products[0].suppressed);
  assert.ok(!reportCsv(after).split('\r\n')[1]);
  // Re-consenting never restores deleted answers.
  await act(db, code, players[2], 'consent', { researchConsent: true, ageConfirmed: true });
  assert.equal((await responses(db)).length, 4);
});

test('the respondent key carries one research identity across games; profile is asked once', async () => {
  const db = await freshDb();
  const first = await createRoom(db, 'Ana', CONSENT);
  assert.match(first.respondentKey, /^[a-f0-9]{48}$/);
  assert.equal((await view(db, first.code, first)).research.profileAsked, false);
  await act(db, first.code, first, 'profile', { skip: true });
  assert.equal((await view(db, first.code, first)).research.profileAsked, true);
  const second = await createRoom(db, 'Ana', { ...CONSENT, respondentKey: first.respondentKey });
  assert.equal(await count(db, 'respondents'), 1);
  assert.equal((await view(db, second.code, second)).research.profileAsked, true);
  await assert.rejects(async () => act(db, second.code, second, 'profile', { ageBand: '17' }), /listed answers/);
  await assert.rejects(async () => act(db, second.code, second, 'consent', { researchConsent: 'yes' }));
});

test('outdated consent is re-asked and upgrading keeps the same research identity', async () => {
  const db = await freshDb();
  const host = await createRoom(db, 'Host', CONSENT);
  await db.prepare("UPDATE consents SET consent_version = 'pricing-research-v1'").run();
  assert.equal((await view(db, host.code, host)).research.status, 'outdated');
  const result = await act(db, host.code, host, 'consent', { researchConsent: true, ageConfirmed: true });
  assert.match(result.respondentKey, /^[a-f0-9]{48}$/);
  assert.equal((await view(db, host.code, host)).research.status, 'active');
  assert.equal(await count(db, 'respondents'), 1);
});

test('price twins appear at the end of the game, only between consenting players', async () => {
  const { db, code, host, players } = await researchRoom(3);
  const outsider = await joinRoom(db, code, 'Outsider');
  const rounds = (await findRoom(db, code)).rounds.length;
  for (let r = 0; r < rounds; r++) {
    const f = [1.2, 0.7, 1.5, 0.9, 1.1, 0.6, 1.3, 1, 0.8, 1.4][r];
    await playRound(db, code, host, [...players, outsider], (p, i) => p * (i === 1 ? f * 1.05 : i === 2 ? 1 / f : f));
    await act(db, code, host, 'next', { roundIndex: r });
  }
  const twin = (await view(db, code, host)).priceTwin;
  assert.equal(twin.name, 'Player 0'); assert.ok(twin.match > 0.95);
  assert.equal((await view(db, code, outsider)).priceTwin, null);
});
