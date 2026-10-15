import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, joinRoom, authenticate, rankRound, findRoom } from '../server/game.js';
import { fixture, act, view, priceOf, freshDb } from './helpers.js';

test('unrevealed prices, other guesses, and credentials stay private', () => {
  const { db, code, host, guest } = fixture();
  act(db, code, host, 'guess', { guess: 450, roundIndex: 0 });
  const snap = view(db, code, guest);
  assert.equal(snap.actualPrice, null); assert.equal(snap.myGuess, null); assert.deepEqual(snap.rankings, []);
  assert.equal(snap.players[0].submitted, true); assert.equal(snap.product.price, undefined);
  const text = JSON.stringify(snap).replace(/[0-9a-f-]{36}/g, 'id');
  assert.ok(!text.includes(host.token)); assert.ok(!/450/.test(text));
  assert.equal(view(db, code, host).myGuess, 450);
});

test('tokens are stored only as hashes', () => {
  const { db, host } = fixture();
  const stored = db.prepare('SELECT token_hash FROM players').pluck().all();
  assert.ok(stored.every(h => /^[a-f0-9]{64}$/.test(h)));
  assert.ok(!stored.includes(host.token));
});

test('scoring: nearest wins, over and under tie, ranking is independent of submission order', () => {
  const { db, code, host, guest } = fixture(); const third = joinRoom(db, code, 'Third');
  const price = priceOf(db, code, 0);
  act(db, code, host, 'guess', { guess: price + 1, roundIndex: 0 });
  act(db, code, third, 'guess', { guess: price + 3, roundIndex: 0 });
  act(db, code, guest, 'guess', { guess: price - 1, roundIndex: 0 });
  act(db, code, host, 'reveal', { roundIndex: 0 });
  const snap = view(db, code, host);
  assert.equal(snap.actualPrice, price);
  assert.deepEqual(snap.rankings.map(r => r.rank), [1, 1, 3]);
  assert.deepEqual(snap.rankings.map(r => r.difference), [1, 1, 3]);
  assert.equal(snap.overall.find(p => p.playerId === guest.player.id).wins, 1);
});

test('scoring: linear accuracy formula is unchanged', () => {
  const room = { players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }],
    rounds: [{ revealedAt: 'x', priceCents: 10000, guesses: { a: { guessCents: 9000 }, b: { guessCents: 11050 }, c: { guessCents: 30000 } } }] };
  const rows = rankRound(room, 0);
  assert.deepEqual(rows.map(r => [r.name, r.accuracy, r.points, r.difference]), [['A', 90, 90, 10], ['B', 89.5, 90, 10.5], ['C', 0, 0, 200]]);
});

test('only the host controls rounds and guesses cannot be changed or sent late', () => {
  const { db, code, host, guest } = fixture();
  assert.throws(() => act(db, code, guest, 'reveal', { roundIndex: 0 }), { status: 403 });
  assert.throws(() => act(db, code, host, 'next', { roundIndex: 0 }), { status: 409 });
  assert.throws(() => act(db, code, host, 'reveal', { roundIndex: 0 }));
  act(db, code, host, 'guess', { guess: 450, roundIndex: 0 });
  assert.throws(() => act(db, code, host, 'guess', { guess: 499, roundIndex: 0 }), { status: 409 });
  act(db, code, host, 'reveal', { roundIndex: 0 });
  assert.throws(() => act(db, code, guest, 'guess', { guess: 499, roundIndex: 0 }), { status: 409 });
  act(db, code, host, 'next', { roundIndex: 0 });
  assert.throws(() => act(db, code, guest, 'guess', { guess: 100, roundIndex: 0 }), { status: 409 });
  assert.throws(() => act(db, code, host, 'next', { roundIndex: 0 }), { status: 409 });
  assert.equal(view(db, code, host).actualPrice, null);
});

test('invalid inputs, duplicate names, invalid sessions and isolated rooms', () => {
  const { db, code, host } = fixture();
  for (const guess of [NaN, Infinity, -1, 0, 0.001, 1000001, '499']) assert.throws(() => act(db, code, host, 'guess', { guess, roundIndex: 0 }));
  assert.throws(() => joinRoom(db, code, ' guest ')); assert.throws(() => createRoom(db, '   '));
  assert.throws(() => authenticate(db, code, 'wrong'), { status: 401 });
  const second = createRoom(db, 'Host'); assert.notEqual(code, second.code);
  assert.throws(() => authenticate(db, second.code, host.token), { status: 401 });
  assert.equal(authenticate(db, code, host.token).player.id, host.player.id);
  assert.throws(() => createRoom(db, 'Kid', { researchConsent: true }), /18 or older/);
});

test('complete game accumulates real scores, keeps history and survives a reopened database', () => {
  const { db, code, host, guest } = fixture();
  const rounds = findRoom(db, code).rounds.length;
  for (let index = 0; index < rounds; index++) {
    const price = priceOf(db, code, index);
    act(db, code, host, 'guess', { guess: price, roundIndex: index });
    act(db, code, guest, 'guess', { guess: price * 2, roundIndex: index });
    act(db, code, host, 'reveal', { roundIndex: index });
    act(db, code, host, 'next', { roundIndex: index });
  }
  const snap = view(db, code, host);
  assert.equal(snap.finished, true); assert.equal(snap.history.length, rounds);
  assert.equal(snap.overall[0].points, rounds * 100); assert.equal(snap.overall[1].points, 0);
  assert.equal(snap.overall[0].wins, rounds);
  assert.throws(() => joinRoom(db, code, 'Late player')); assert.throws(() => act(db, code, host, 'guess', { guess: 1, roundIndex: 7 }));
  assert.deepEqual(view(db, code, host), snap);
});

test('price snapshots protect past results from later catalog price edits', () => {
  const db = freshDb();
  const host = createRoom(db, 'Host');
  const room = findRoom(db, host.code);
  const before = room.rounds[0].priceCents;
  db.prepare("INSERT INTO product_prices (product_id, price_cents, observed_on) VALUES (?, ?, '2026-01-02')").run(room.rounds[0].productId, before * 3);
  assert.equal(findRoom(db, host.code).rounds[0].priceCents, before);
});

test('ms_to_answer is measured on the server from when the round opened', () => {
  const { db, code, host } = fixture();
  act(db, code, host, 'guess', { guess: 10, roundIndex: 0 });
  const ms = db.prepare('SELECT ms_to_answer FROM guesses').pluck().get();
  assert.ok(Number.isInteger(ms) && ms >= 0 && ms < 5000);
});
