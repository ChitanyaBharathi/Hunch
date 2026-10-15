import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { openDb } from '../server/db/index.js';
import { createRoom, joinRoom, findRoom, authenticate, applyAction, snapshot } from '../server/game.js';

export const freshDb = () => openDb(':memory:');
export const CONSENT = { researchConsent: true, ageConfirmed: true };

export function act(db, code, who, action, body = {}) {
  const { room, player } = authenticate(db, code, who.token);
  return applyAction(db, room, player, action, body);
}
export function view(db, code, who) {
  const { room, player } = authenticate(db, code, who.token);
  return snapshot(db, room, player);
}
export const priceOf = (db, code, index) => findRoom(db, code).rounds[index].priceCents / 100;
export const roundIndex = (db, code) => findRoom(db, code).currentRoundNo - 1;

// A room with a host and one guest. Pass research options to opt both in.
export function fixture(research = {}) {
  const db = freshDb();
  const host = createRoom(db, 'Host', research);
  const guest = joinRoom(db, host.code, 'Guest', research);
  return { db, code: host.code, host, guest };
}

// N consenting players guess `guessFor(price, i)` on the current round, then the host reveals.
export function playRound(db, code, host, players, guessFor, extra = () => ({})) {
  const index = roundIndex(db, code);
  const price = priceOf(db, code, index);
  players.forEach((p, i) => act(db, code, p, 'guess', { roundIndex: index, guess: guessFor(price, i), ...extra(price, i) }));
  act(db, code, host, 'reveal', { roundIndex: index });
  return price;
}

export async function startServer(env = {}) {
  const child = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, GAME_PORT: '0', GAME_EPHEMERAL: '1', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  const base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server startup timed out')), 8000);
    child.on('error', reject);
    child.stdout.on('data', chunk => { const match = String(chunk).match(/http:\/\/127\.0\.0\.1:\d+/); if (match) { clearTimeout(timer); resolve(match[0]); } });
  });
  const request = async (path, body, token, method) => {
    const response = await fetch(`${base}${path}`, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const text = await response.text();
    let data; try { data = JSON.parse(text); } catch { data = text; }
    return { status: response.status, data, headers: response.headers };
  };
  return { base, request, output: () => output, stop: async () => { const exited = once(child, 'exit'); child.kill(); await exited; } };
}
