import { UNBRANDED } from '../brandFrames.js';
// Game tables: rooms, rounds, players, guesses. Player names live here and nowhere in research tables.

export const codeExists = (db, code) => Boolean(db.prepare('SELECT 1 FROM rooms WHERE code = ?').get(code));

export function insertRoom(db, { code, createdAt, hostPlayerId = null, status = 'playing', currentRoundNo = 1, endedAt = null, mode = 'party', dailyDate = null }) {
  return db.prepare('INSERT INTO rooms (code, host_player_id, created_at, status, current_round_no, ended_at, mode, daily_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(code, hostPlayerId, createdAt, status, currentRoundNo, endedAt, mode, dailyDate).lastInsertRowid;
}
export const setHost = (db, roomId, playerId) => db.prepare('UPDATE rooms SET host_player_id = ? WHERE id = ?').run(playerId, roomId);

export function insertRound(db, { roomId, roundNo, productId, priceId, priceCents, startedAt = null, revealedAt = null, frame = 'standard' }) {
  return db.prepare('INSERT INTO rounds (room_id, round_no, product_id, price_id, price_snapshot_cents, started_at, revealed_at, frame) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(roomId, roundNo, productId, priceId, priceCents, startedAt, revealedAt, frame).lastInsertRowid;
}

export function insertPlayer(db, { id, roomId, name, tokenHash, joinedAt }) {
  db.prepare('INSERT INTO players (id, room_id, display_name, token_hash, joined_at) VALUES (?, ?, ?, ?, ?)').run(id, roomId, name, tokenHash, joinedAt);
}
export const playerByToken = (db, roomId, tokenHash) =>
  db.prepare('SELECT id, display_name AS name, joined_at AS joinedAt FROM players WHERE room_id = ? AND token_hash = ?').get(roomId, tokenHash);

export function insertGuess(db, { roundId, playerId, guessCents, maxPayCents = null, tooCheapCents = null, submittedAt, msToAnswer = null, consentId = null }) {
  db.prepare(`INSERT INTO guesses (round_id, player_id, guess_cents, max_pay_cents, too_cheap_cents, submitted_at, ms_to_answer, consent_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(roundId, playerId, guessCents, maxPayCents, tooCheapCents, submittedAt, msToAnswer, consentId);
}

export const revealRound = (db, roundId, at) => db.prepare('UPDATE rounds SET revealed_at = ? WHERE id = ? AND revealed_at IS NULL').run(at, roundId);
export function advanceRoom(db, roomId, nextRoundNo, at) {
  db.prepare('UPDATE rooms SET current_round_no = ? WHERE id = ?').run(nextRoundNo, roomId);
  db.prepare('UPDATE rounds SET started_at = ? WHERE room_id = ? AND round_no = ?').run(at, roomId, nextRoundNo);
}
export const startRound = (db, roundId, at) => db.prepare('UPDATE rounds SET started_at = ? WHERE id = ? AND started_at IS NULL').run(at, roundId);
export const finishRoom = (db, roomId, at) => db.prepare("UPDATE rooms SET status = 'finished', ended_at = ? WHERE id = ?").run(at, roomId);

// What players see: the unbranded arm swaps in plain copy and drops the brand.
const framed = (round, shown) => {
  const plain = round.frame === 'unbranded' && UNBRANDED[round.productId];
  return plain ? { title: plain[0], brand: null, description: plain[1] } : shown;
};

// One room with everything the rules and snapshot need, in the shape the game logic works with.
export function loadRoom(db, code) {
  const row = db.prepare(`SELECT id, code, host_player_id AS hostId, status, current_round_no AS currentRoundNo, created_at AS createdAt, mode, daily_date AS dailyDate
    FROM rooms WHERE code = ?`).get(code);
  if (!row) return null;
  const players = db.prepare('SELECT id, display_name AS name, joined_at AS joinedAt FROM players WHERE room_id = ? ORDER BY joined_at, rowid').all(row.id);
  const rounds = db.prepare(`SELECT r.id, r.round_no AS roundNo, r.product_id AS productId, r.price_snapshot_cents AS priceCents,
      r.started_at AS startedAt, r.revealed_at AS revealedAt, r.frame, p.name AS title, p.brand, c.name AS category, p.description,
      p.image_url AS imageUrl, p.emoji, p.unit_size AS unitSize, pp.source_url AS sourceUrl
    FROM rounds r JOIN products p ON p.id = r.product_id JOIN categories c ON c.id = p.category_id
    LEFT JOIN product_prices pp ON pp.id = r.price_id WHERE r.room_id = ? ORDER BY r.round_no`).all(row.id);
  const guesses = db.prepare(`SELECT g.round_id AS roundId, g.player_id AS playerId, g.guess_cents AS guessCents, g.max_pay_cents AS maxPayCents,
      g.too_cheap_cents AS tooCheapCents, g.submitted_at AS submittedAt, g.ms_to_answer AS msToAnswer,
      g.consent_id AS consentId
    FROM guesses g JOIN rounds r ON r.id = g.round_id WHERE r.room_id = ?`).all(row.id);
  return { ...row, players, rounds: rounds.map(({ sourceUrl, title, brand, category, description, imageUrl, emoji, unitSize, ...round }) => ({
    ...round,
    product: { id: round.productId, ...framed(round, { title, brand, description }), category, imageUrl, emoji, unitSize, benchmarkStatus: sourceUrl ? 'verified' : 'demo', imageKind: 'illustrative' },
    guesses: Object.fromEntries(guesses.filter(g => g.roundId === round.id).map(({ roundId: _r, playerId, ...g }) => [playerId, g])),
  })) };
}
