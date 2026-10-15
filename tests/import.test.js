import test from 'node:test';
import assert from 'node:assert/strict';
import { importRooms } from '../server/db/importRooms.js';
import { authenticate, snapshot } from '../server/game.js';
import { freshDb } from './helpers.js';

const legacy = {
  rooms: {
    ABC123: {
      code: 'ABC123', hostId: 'h', roundIndex: 1, finished: false,
      players: [
        { id: 'h', token: 'a'.repeat(48), name: 'Host', researchConsent: true, consentVersion: 'pricing-research-v1', consentUpdatedAt: '2026-10-09T10:00:00.000Z' },
        { id: 'g', token: 'b'.repeat(48), name: 'Guest' },
      ],
      rounds: [
        { productId: 'prod_1', revealed: true, guesses: { h: 450, g: 500 }, research: { h: { submittedAt: '2026-10-09T10:01:00.000Z', consentVersion: 'pricing-research-v1', maximumPay: 400 } } },
        { productId: 'prod_2', revealed: false, guesses: {} },
        ...['prod_3', 'prod_4', 'prod_5', 'prod_6', 'prod_7', 'prod_8', 'item_009', 'item_010'].map(productId => ({ productId, revealed: false, guesses: {} })),
      ],
    },
  },
};

test('rooms.json import keeps sessions working, game state intact and re-asks old consents', () => {
  const db = freshDb();
  const summary = importRooms(db, legacy);
  assert.deepEqual({ rooms: summary.rooms, players: summary.players, guesses: summary.guesses, respondents: summary.respondents, responses: summary.responses },
    { rooms: 1, players: 2, guesses: 2, respondents: 1, responses: 1 });
  const { room, player } = authenticate(db, 'ABC123', 'a'.repeat(48));
  const snap = snapshot(db, room, player);
  assert.equal(snap.roundIndex, 1); assert.equal(snap.history.length, 1);
  assert.equal(snap.history[0].rankings[0].name, 'Guest'); // S$500 is nearer S$499 than S$450
  assert.equal(snap.research.status, 'outdated');
  const response = db.prepare('SELECT * FROM responses').get();
  assert.equal(response.guess_cents, 45000); assert.equal(response.max_pay_cents, 40000); assert.equal(response.prev_product_price_cents, null);
  assert.equal(importRooms(db, legacy).skipped, 1, 'Re-running skips rooms already imported');
  assert.equal(db.prepare('SELECT COUNT(*) FROM rooms').pluck().get(), 1);
});
