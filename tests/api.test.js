import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers.js';

test('two independent phone sessions share guesses, reveal, rankings and next round over HTTP', async () => {
  const server = await startServer();
  const { request } = server;
  try {
    const host = await request('/api/rooms', { name: 'Phone one' });
    assert.equal(host.status, 201);
    const { code, token: hostToken } = host.data.session;
    const guest = await request(`/api/rooms/${code}/join`, { name: 'Phone two' });
    assert.equal(guest.status, 201); const guestToken = guest.data.session.token;
    assert.equal((await request(`/api/rooms/${code}/insights`, undefined, guestToken)).status, 403);
    assert.equal((await request(`/api/rooms/${code}/insights`, undefined, hostToken)).status, 200);
    assert.equal((await request(`/api/rooms/${code}/insights.csv`, undefined, guestToken)).status, 403);
    assert.equal((await request(`/api/rooms/${code}`)).status, 401);
    assert.equal((await request(`/api/rooms/${code}/guess`, { guess: 450, roundIndex: 0 }, hostToken)).status, 409, 'lobby: not started yet');
    assert.equal((await request(`/api/rooms/${code}/start`, { roundIndex: 0 }, hostToken)).status, 200);
    assert.equal((await request(`/api/rooms/${code}/guess`, { guess: 450, roundIndex: 0 }, hostToken)).status, 200);
    assert.equal((await request(`/api/rooms/${code}/guess`, { guess: 500, roundIndex: 0 }, guestToken)).status, 200);
    const hidden = await request(`/api/rooms/${code}`, undefined, guestToken);
    assert.equal(hidden.data.submittedCount, 2); assert.equal(hidden.data.actualPrice, null);
    assert.equal(hidden.data.myGuess, 500); assert.deepEqual(hidden.data.rankings, []);
    assert.equal((await request(`/api/rooms/${code}/reveal`, { roundIndex: 0 }, guestToken)).status, 403);
    const revealed = await request(`/api/rooms/${code}/reveal`, { roundIndex: 0 }, hostToken);
    const price = revealed.data.actualPrice;
    assert.ok(price > 0);
    assert.equal(revealed.data.rankings[0].difference, Math.round(Math.min(Math.abs(450 - price), Math.abs(500 - price)) * 100) / 100);
    assert.equal((await request(`/api/rooms/${code}`, undefined, guestToken)).data.revealed, true);
    await request(`/api/rooms/${code}/next`, { roundIndex: 0 }, hostToken);
    const next = await request(`/api/rooms/${code}`, undefined, guestToken);
    assert.equal(next.data.roundIndex, 1); assert.equal(next.data.myGuess, null); assert.equal(next.data.actualPrice, null);
    assert.equal(next.data.history.length, 1);
    const another = await request('/api/rooms', { name: 'Other host' });
    assert.equal(another.data.room.players.length, 1);
    assert.equal((await request(`/api/rooms/${another.data.session.code}`, undefined, guestToken)).status, 401);
    const consent = await request('/api/consent');
    assert.equal(consent.data.version, 'hunch-research-v2'); assert.match(consent.data.text, /18 or older/);
  } finally { await server.stop(); }
});

test('room creation and joining are rate-limited per client', async () => {
  const server = await startServer();
  try {
    let status = 0;
    for (let i = 0; i < 31 && status !== 429; i++) status = (await server.request('/api/rooms', { name: `Host ${i}` })).status;
    assert.equal(status, 429);
  } finally { await server.stop(); }
});
