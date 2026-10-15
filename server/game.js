import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { selectProducts, dailyProducts } from './roundSelection.js';
import { UNBRANDED } from './brandFrames.js';
import { pricedProducts, today } from './db/catalog.js';
import * as q from './db/game.js';
import * as identity from './db/identity.js';
import { insertResponse, studyForProduct, activeStudyProductIds } from './db/research.js';
import { CONSENT_VERSION, CONSENT_TEXT_HASH, PROFILE_OPTIONS } from './consent.js';
import { priceTwin } from './analytics/twins.js';

export const hashToken = token => createHash('sha256').update(String(token)).digest('hex');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const now = () => new Date().toISOString();
const cleanName = value => {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (!name || name.length > 30) fail('Enter a name between 1 and 30 characters.');
  return name;
};
const money = (value, message, { min = 0.01, allowNull = false } = {}) => {
  if (allowNull && (value === null || value === undefined)) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > 1000000) fail(message);
  return Math.round(value * 100);
};

// Research enrolment: consent requires confirming age 18+. Returns the browser key for the respondent.
function enrolResearch(db, playerId, { researchConsent, ageConfirmed, respondentKey } = {}) {
  if (researchConsent !== true) return null;
  if (ageConfirmed !== true) fail('Confirm you are 18 or older to contribute to research.');
  // A player re-consenting to a newer text keeps their existing research identity.
  const linked = identity.respondentForPlayer(db, playerId);
  const { respondentId, key } = linked ? { respondentId: linked, key: identity.rekey(db, linked) } : identity.findOrCreateRespondent(db, respondentKey);
  identity.linkPlayer(db, playerId, respondentId);
  identity.grantConsent(db, respondentId, { version: CONSENT_VERSION, textHash: CONSENT_TEXT_HASH });
  return key;
}

function addPlayer(db, roomId, name, research) {
  const token = randomBytes(24).toString('hex');
  const id = randomUUID();
  q.insertPlayer(db, { id, roomId, name, tokenHash: hashToken(token), joinedAt: now() });
  return { player: { id, name }, token, respondentKey: enrolResearch(db, id, research) };
}

export function createRoom(db, name, research = {}, { mode = 'party', lobby = false } = {}) {
  const clean = cleanName(name);
  if (!['party', 'daily'].includes(mode)) fail('Choose a valid game mode.');
  return db.transaction(() => {
    let code;
    do { code = randomBytes(3).toString('hex').toUpperCase(); } while (q.codeExists(db, code));
    const at = now();
    const date = today();
    const roomId = q.insertRoom(db, { code, createdAt: at, mode, dailyDate: mode === 'daily' ? date : null });
    const catalog = pricedProducts(db, date);
    const products = mode === 'daily' ? dailyProducts(date, catalog) : selectProducts(undefined, catalog, { priorityIds: activeStudyProductIds(db, date) });
    // Snapshot each round's price now, so later catalog price edits never change this game's results.
    products.forEach((p, i) =>
      q.insertRound(db, { roomId, roundNo: i + 1, productId: p.id, priceId: p.priceId, priceCents: p.priceCents, startedAt: i === 0 && !(lobby && mode === 'party') ? at : null,
        frame: UNBRANDED[p.id] && randomBytes(1)[0] < 128 ? 'unbranded' : 'standard' }));
    const joined = addPlayer(db, roomId, clean, research);
    q.setHost(db, roomId, joined.player.id);
    return { code, ...joined };
  })();
}

export function findRoom(db, code) {
  const room = q.loadRoom(db, String(code).toUpperCase());
  if (!room) fail('Room not found. Check the code with your host.', 404);
  return room;
}

export function joinRoom(db, code, name, research = {}) {
  const room = findRoom(db, code);
  if (room.mode === 'daily') fail('Daily challenges are solo. Start your own from the home screen.');
  if (room.status === 'finished') fail('This game has finished. Ask the host to create a new room.');
  const clean = cleanName(name);
  if (room.players.some(p => p.name.toLowerCase() === clean.toLowerCase())) fail('That name is taken. Add your surname or a nickname.');
  if (room.players.length >= 100) fail('This room is full.');
  return db.transaction(() => ({ code: room.code, ...addPlayer(db, room.id, clean, research) }))();
}

export function authenticate(db, code, token) {
  const room = findRoom(db, code);
  const player = typeof token === 'string' && token ? q.playerByToken(db, room.id, hashToken(token)) : null;
  if (!player) fail('Your session is no longer valid. Join the room again.', 401);
  return { room, player };
}

// Research rows are written only here, at reveal, for guesses made under a consent that is still active now.
function writeResearch(db, room, round, at) {
  const consents = identity.activeConsentsInRoom(db, room.id);
  const previous = room.rounds.find(r => r.roundNo === round.roundNo - 1);
  const studyId = studyForProduct(db, round.productId, at.slice(0, 10));
  for (const [playerId, g] of Object.entries(round.guesses)) {
    const consent = consents.get(playerId);
    if (!consent || consent.consentId !== g.consentId) continue;
    insertResponse(db, { respondentId: consent.respondentId, productId: round.productId, roundPosition: round.roundNo,
      prevPriceCents: previous?.priceCents ?? null, actualCents: round.priceCents, guessCents: g.guessCents,
      maxPayCents: g.maxPayCents, tooCheapCents: g.tooCheapCents, msToAnswer: g.msToAnswer, answeredAt: g.submittedAt, studyId, frame: round.frame ?? 'standard' });
  }
}

// Returns extra fields for the response (e.g. a new respondent key), or undefined.
export function applyAction(db, room, player, action, body = {}) {
  if (action === 'consent') {
    if (typeof body.researchConsent !== 'boolean') fail('Choose a valid research preference.');
    const current = identity.playerResearch(db, player.id);
    if (body.researchConsent) {
      if (current.status === 'active') return undefined;
      return { respondentKey: db.transaction(() => enrolResearch(db, player.id, body))() };
    }
    if (current.respondentId) identity.withdraw(db, current.respondentId);
    return undefined;
  }
  if (action === 'profile') {
    const current = identity.playerResearch(db, player.id);
    if (current.status !== 'active') fail('Profile questions are only for research participants.', 403);
    const answers = {};
    for (const [field, allowed] of Object.entries(PROFILE_OPTIONS)) {
      const value = body.skip === true ? null : body[field] ?? null;
      if (value !== null && !allowed.includes(value)) fail('Choose one of the listed answers.');
      answers[field] = value;
    }
    identity.saveProfile(db, current.respondentId, answers);
    return undefined;
  }
  const round = room.rounds[room.currentRoundNo - 1];
  if (room.status === 'finished') fail('The game is finished.');
  const inLobby = room.currentRoundNo === 1 && !round.startedAt;
  if (action === 'guess') {
    if (inLobby) fail('The host hasn’t started the game yet.', 409);
    if (body.roundIndex !== room.currentRoundNo - 1) fail('The round changed. Try your guess on the new item.', 409);
    if (round.revealedAt) fail('Guesses are closed for this round.', 409);
    if (Object.hasOwn(round.guesses, player.id)) fail('Your guess is already locked in.', 409);
    if (typeof body.guess !== 'number' || !Number.isFinite(body.guess) || body.guess <= 0 || body.guess > 1000000) fail('Enter a price between S$0.01 and S$1,000,000.');
    const guessCents = Math.round(body.guess * 100);
    if (guessCents === 0) fail('Enter at least S$0.01.');
    const maxPayCents = money(body.maximumPay, 'Enter a maximum price between S$0 and S$1,000,000, or leave it blank.', { min: 0, allowNull: true });
    const tooCheapCents = money(body.tooCheap, 'Enter a "too cheap" price between S$0 and S$1,000,000, or leave it blank.', { min: 0, allowNull: true });
    // The optional research answers are kept only for players who are research participants at this moment.
    const research = identity.playerResearch(db, player.id);
    const researching = research.status === 'active';
    const submittedAt = now();
    const startedAt = [round.startedAt, player.joinedAt].filter(Boolean).sort().at(-1);
    q.insertGuess(db, { roundId: round.id, playerId: player.id, guessCents, submittedAt,
      maxPayCents: researching ? maxPayCents : null, tooCheapCents: researching ? tooCheapCents : null, consentId: researching ? research.consentId : null,
      msToAnswer: startedAt ? Math.max(0, Date.parse(submittedAt) - Date.parse(startedAt)) : null });
    if (room.mode === 'daily') {
      const fresh = q.loadRoom(db, room.code);
      const freshRound = fresh.rounds[fresh.currentRoundNo - 1];
      db.transaction(() => { q.revealRound(db, freshRound.id, submittedAt); writeResearch(db, fresh, freshRound, submittedAt); })();
    }
    return undefined;
  }
  if (player.id !== room.hostId) fail('Only the host can control the round.', 403);
  if (body.roundIndex !== room.currentRoundNo - 1) fail('The round changed. Refresh and try again.', 409);
  if (action === 'start') {
    if (!inLobby) fail('The game has already started.', 409);
    q.startRound(db, round.id, now());
  } else if (action === 'reveal') {
    if (round.revealedAt) fail('The price is already revealed.', 409);
    if (!Object.keys(round.guesses).length) fail('Wait for at least one guess before revealing.');
    const at = now();
    db.transaction(() => { q.revealRound(db, round.id, at); writeResearch(db, room, round, at); })();
  } else if (action === 'next') {
    if (!round.revealedAt) fail('Reveal this round before moving on.', 409);
    if (room.currentRoundNo === room.rounds.length) q.finishRoom(db, room.id, now());
    else q.advanceRoom(db, room.id, room.currentRoundNo + 1, now());
  } else fail('Unknown action.', 404);
  return undefined;
}

// Linear game scoring, unchanged: accuracy = max(0, 100 × (1 − |guess − price| / price)), points = rounded accuracy.
export function rankRound(room, index) {
  const round = room.rounds[index];
  if (!round?.revealedAt) return [];
  const rows = room.players.filter(p => Object.hasOwn(round.guesses, p.id)).map(p => {
    const guessCents = round.guesses[p.id].guessCents;
    const differenceCents = Math.abs(guessCents - round.priceCents);
    const accuracy = Math.max(0, Math.round((1 - differenceCents / round.priceCents) * 1000) / 10);
    return { playerId: p.id, name: p.name, guess: guessCents / 100, difference: differenceCents / 100, accuracy, points: Math.round(accuracy) };
  }).sort((a, b) => a.difference - b.difference || a.name.localeCompare(b.name));
  return rows.map(row => ({ ...row, rank: rows.findIndex(other => other.difference === row.difference) + 1 }));
}

// "You and Hari price things alike": only between players who both have active research consent.
function roomTwin(db, room, player) {
  const consenting = identity.activeConsentsInRoom(db, room.id);
  if (!consenting.has(player.id)) return null;
  const revealed = room.rounds.filter(r => r.revealedAt);
  const people = room.players.filter(p => consenting.has(p.id)).map(p => ({ id: p.id, name: p.name,
    vector: Object.fromEntries(revealed.filter(r => r.guesses[p.id]).map(r => [r.roundNo, Math.log(r.guesses[p.id].guessCents / r.priceCents)])) }));
  return priceTwin(player.id, people);
}

// A shareable read of how someone prices things, from their own guesses only. Bias = log(guess / price).
const STYLES = {
  calibrated: { name: 'Calibrated Shopper', line: 'Your instincts track real prices. Retailers can’t fool you easily.' },
  premium: { name: 'Premium Believer', line: 'You expect things to cost more than they do. Sale stickers work on you.' },
  bargain: { name: 'Bargain Anchor', line: 'Your mental prices are stuck a few years back. Checkout surprises you.' },
  wildcard: { name: 'Wildcard', line: 'Spot on one round, miles off the next. Nobody can predict you, including you.' },
};
export function priceStyle(room, playerId) {
  const biases = room.rounds.filter(r => r.revealedAt && r.guesses[playerId]).map(r => Math.log(r.guesses[playerId].guessCents / r.priceCents));
  if (biases.length < 3) return null;
  const mean = biases.reduce((a, b) => a + b, 0) / biases.length;
  const spread = Math.sqrt(biases.reduce((a, b) => a + (b - mean) ** 2, 0) / biases.length);
  const key = spread > 0.6 ? 'wildcard' : mean > 0.15 ? 'premium' : mean < -0.15 ? 'bargain' : 'calibrated';
  return { key, ...STYLES[key], biasPct: Math.round((Math.exp(mean) - 1) * 100) };
}

export function snapshot(db, room, player) {
  const round = room.rounds[room.currentRoundNo - 1];
  const finished = room.status === 'finished';
  const research = identity.playerResearch(db, player.id);
  const overall = room.players.map(p => {
    const results = room.rounds.flatMap((_, index) => rankRound(room, index).filter(row => row.playerId === p.id));
    return { playerId: p.id, name: p.name, points: results.reduce((total, r) => total + r.points, 0),
      wins: results.filter(r => r.rank === 1).length, roundsPlayed: results.length,
      averageAccuracy: results.length ? Math.round(results.reduce((total, r) => total + r.accuracy, 0) / results.length * 10) / 10 : 0 };
  }).sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  return { code: room.code, hostId: room.hostId, selfId: player.id, isHost: room.hostId === player.id,
    researchConsent: research.status === 'active', research: { status: research.status, profileAsked: research.profileAsked, consentVersion: CONSENT_VERSION },
    roundIndex: room.currentRoundNo - 1, totalRounds: room.rounds.length, finished, lobby: room.currentRoundNo === 1 && !round.startedAt, revealed: Boolean(round.revealedAt),
    product: round.product,
    actualPrice: round.revealedAt ? round.priceCents / 100 : null, myGuess: round.guesses[player.id] ? round.guesses[player.id].guessCents / 100 : null,
    submittedCount: Object.keys(round.guesses).length,
    players: room.players.map(p => ({ id: p.id, name: p.name, submitted: Object.hasOwn(round.guesses, p.id) })),
    rankings: rankRound(room, room.currentRoundNo - 1),
    overall: overall.map(row => ({ ...row, rank: overall.findIndex(other => other.points === row.points) + 1 })),
    history: room.rounds.flatMap((r, index) => r.revealedAt ? [{ roundIndex: index, title: r.product.title, rankings: rankRound(room, index) }] : []),
    priceTwin: finished ? roomTwin(db, room, player) : null,
    mode: room.mode ?? 'party', dailyDate: room.dailyDate ?? null,
    priceStyle: finished ? priceStyle(room, player.id) : null };
}
