import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, joinRoom, authenticate, rankRound, findRoom } from '../server/game.js';
import { fixture, act, view, priceOf, freshDb } from './helpers.js';

test('unrevealed prices, other guesses, and credentials stay private', async () => {
  const { db, code, host, guest } = await fixture();
  await act(db, code, host, 'guess', { guess: 450, roundIndex: 0 });
  const snap = await view(db, code, guest);
  assert.equal(snap.actualPrice, null); assert.equal(snap.myGuess, null); assert.deepEqual(snap.rankings, []);
  assert.equal(snap.players[0].submitted, true); assert.equal(snap.product.price, undefined);
  const text = JSON.stringify(snap).replace(/[0-9a-f-]{36}/g, 'id');
  assert.ok(!text.includes(host.token)); assert.ok(!/450/.test(text));
  assert.equal((await view(db, code, host)).myGuess, 450);
});

test('tokens are stored only as hashes', async () => {
  const { db, host } = await fixture();
  const stored = await db.prepare('SELECT token_hash FROM players').pluck().all();
  assert.ok(stored.every(h => /^[a-f0-9]{64}$/.test(h)));
  assert.ok(!stored.includes(host.token));
});

test('scoring: nearest wins, over and under tie, ranking is independent of submission order', async () => {
  const { db, code, host, guest } = await fixture(); const third = await joinRoom(db, code, 'Third');
  const price = await priceOf(db, code, 0);
  await act(db, code, host, 'guess', { guess: price + 1, roundIndex: 0 });
  await act(db, code, third, 'guess', { guess: price + 3, roundIndex: 0 });
  await act(db, code, guest, 'guess', { guess: price - 1, roundIndex: 0 });
  await act(db, code, host, 'reveal', { roundIndex: 0 });
  const snap = await view(db, code, host);
  assert.equal(snap.actualPrice, price);
  assert.deepEqual(snap.rankings.map(r => r.rank), [1, 1, 3]);
  assert.deepEqual(snap.rankings.map(r => r.difference), [1, 1, 3]);
  assert.equal(snap.overall.find(p => p.playerId === guest.player.id).wins, 1);
});

test('scoring: linear accuracy formula is unchanged', async () => {
  const room = { players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }],
    rounds: [{ revealedAt: 'x', priceCents: 10000, guesses: { a: { guessCents: 9000 }, b: { guessCents: 11050 }, c: { guessCents: 30000 } } }] };
  const rows = rankRound(room, 0);
  assert.deepEqual(rows.map(r => [r.name, r.accuracy, r.points, r.difference]), [['A', 90, 90, 10], ['B', 89.5, 90, 10.5], ['C', 0, 0, 200]]);
});

test('only the host controls rounds and guesses cannot be changed or sent late', async () => {
  const { db, code, host, guest } = await fixture();
  await assert.rejects(async () => act(db, code, guest, 'reveal', { roundIndex: 0 }), { status: 403 });
  await assert.rejects(async () => act(db, code, host, 'next', { roundIndex: 0 }), { status: 409 });
  await assert.rejects(async () => act(db, code, host, 'reveal', { roundIndex: 0 }));
  await act(db, code, host, 'guess', { guess: 450, roundIndex: 0 });
  await assert.rejects(async () => act(db, code, host, 'guess', { guess: 499, roundIndex: 0 }), { status: 409 });
  await act(db, code, host, 'reveal', { roundIndex: 0 });
  await assert.rejects(async () => act(db, code, guest, 'guess', { guess: 499, roundIndex: 0 }), { status: 409 });
  await act(db, code, host, 'next', { roundIndex: 0 });
  await assert.rejects(async () => act(db, code, guest, 'guess', { guess: 100, roundIndex: 0 }), { status: 409 });
  await assert.rejects(async () => act(db, code, host, 'next', { roundIndex: 0 }), { status: 409 });
  assert.equal((await view(db, code, host)).actualPrice, null);
});

test('invalid inputs, duplicate names, invalid sessions and isolated rooms', async () => {
  const { db, code, host } = await fixture();
  for (const guess of [NaN, Infinity, -1, 0, 0.001, 1000001, '499']) await assert.rejects(async () => act(db, code, host, 'guess', { guess, roundIndex: 0 }));
  await assert.rejects(async () => joinRoom(db, code, ' guest ')); await assert.rejects(async () => createRoom(db, '   '));
  await assert.rejects(async () => authenticate(db, code, 'wrong'), { status: 401 });
  const second = await createRoom(db, 'Host'); assert.notEqual(code, second.code);
  await assert.rejects(async () => authenticate(db, second.code, host.token), { status: 401 });
  assert.equal((await authenticate(db, code, host.token)).player.id, host.player.id);
  await assert.rejects(async () => createRoom(db, 'Kid', { researchConsent: true }), /18 or older/);
});

test('complete game accumulates real scores, keeps history and survives a reopened database', async () => {
  const { db, code, host, guest } = await fixture();
  const rounds = (await findRoom(db, code)).rounds.length;
  for (let index = 0; index < rounds; index++) {
    const price = await priceOf(db, code, index);
    await act(db, code, host, 'guess', { guess: price, roundIndex: index });
    await act(db, code, guest, 'guess', { guess: price * 2, roundIndex: index });
    await act(db, code, host, 'reveal', { roundIndex: index });
    await act(db, code, host, 'next', { roundIndex: index });
  }
  const snap = await view(db, code, host);
  assert.equal(snap.finished, true); assert.equal(snap.history.length, rounds);
  assert.equal(snap.overall[0].points, rounds * 100); assert.equal(snap.overall[1].points, 0);
  assert.equal(snap.overall[0].wins, rounds);
  await assert.rejects(async () => joinRoom(db, code, 'Late player')); await assert.rejects(async () => act(db, code, host, 'guess', { guess: 1, roundIndex: 7 }));
  assert.deepEqual(await view(db, code, host), snap);
});

test('price snapshots protect past results from later catalog price edits', async () => {
  const db = await freshDb();
  const host = await createRoom(db, 'Host');
  const room = await findRoom(db, host.code);
  const before = room.rounds[0].priceCents;
  await db.prepare("INSERT INTO product_prices (product_id, price_cents, observed_on) VALUES (?, ?, '2026-01-02')").run(room.rounds[0].productId, before * 3);
  assert.equal((await findRoom(db, host.code)).rounds[0].priceCents, before);
});

test('ms_to_answer is measured on the server from when the round opened', async () => {
  const { db, code, host } = await fixture();
  await act(db, code, host, 'guess', { guess: 10, roundIndex: 0 });
  const ms = await db.prepare('SELECT ms_to_answer FROM guesses').pluck().get();
  assert.ok(Number.isInteger(ms) && ms >= 0 && ms < 5000);
});
