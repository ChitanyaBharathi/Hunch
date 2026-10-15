import { randomUUID } from 'node:crypto';
import { pricedProducts } from './catalog.js';
import { insertRoom, insertRound, insertPlayer, insertGuess, codeExists } from './game.js';
import { linkPlayer } from './identity.js';
import { insertResponse } from './research.js';
import { hashToken } from '../game.js';
import { LEGACY_CONSENT_VERSION, LEGACY_CONSENT_TEXT_HASH } from '../consent.js';

const cents = dollars => Math.round(Number(dollars) * 100);

// Moves the old JSON room store into SQLite. Idempotent: rooms whose code already exists are skipped.
// Old opt-ins are recorded under the legacy consent version, so those players are asked again for the new text;
// their earlier research answers (given under that legacy consent) are kept as research responses.
export function importRooms(db, legacy, { importedAt = new Date().toISOString() } = {}) {
  const prices = new Map(pricedProducts(db, '9999-12-31').map(p => [p.id, p]));
  const summary = { rooms: 0, skipped: 0, players: 0, guesses: 0, respondents: 0, responses: 0 };
  db.transaction(() => {
    for (const room of Object.values(legacy?.rooms ?? {})) {
      if (codeExists(db, room.code) || !room.rounds?.every(r => prices.has(r.productId))) { summary.skipped += 1; continue; }
      const roomId = insertRoom(db, { code: room.code, createdAt: importedAt, hostPlayerId: room.hostId,
        status: room.finished ? 'finished' : 'playing', currentRoundNo: (room.roundIndex ?? 0) + 1, endedAt: room.finished ? importedAt : null });
      const roundIds = room.rounds.map((r, i) => insertRound(db, { roomId, roundNo: i + 1, productId: r.productId,
        priceId: prices.get(r.productId).priceId, priceCents: prices.get(r.productId).priceCents, revealedAt: r.revealed ? importedAt : null }));
      const respondents = new Map();
      for (const p of room.players) {
        insertPlayer(db, { id: p.id, roomId, name: p.name, tokenHash: hashToken(p.token), joinedAt: importedAt });
        summary.players += 1;
        if (p.researchConsent !== true) continue;
        const respondentId = randomUUID();
        db.prepare('INSERT INTO respondents (id, created_at) VALUES (?, ?)').run(respondentId, importedAt);
        db.prepare('INSERT INTO consents (respondent_id, consent_version, consent_text_hash, granted_at) VALUES (?, ?, ?, ?)')
          .run(respondentId, LEGACY_CONSENT_VERSION, LEGACY_CONSENT_TEXT_HASH, p.consentUpdatedAt ?? importedAt);
        linkPlayer(db, p.id, respondentId);
        respondents.set(p.id, respondentId);
        summary.respondents += 1;
      }
      room.rounds.forEach((r, i) => {
        for (const [playerId, guess] of Object.entries(r.guesses ?? {})) {
          const event = r.research?.[playerId];
          const maxPayCents = event?.maximumPay === null || event?.maximumPay === undefined ? null : cents(event.maximumPay);
          const submittedAt = event?.submittedAt ?? importedAt;
          insertGuess(db, { roundId: roundIds[i], playerId, guessCents: cents(guess), maxPayCents, submittedAt });
          summary.guesses += 1;
          if (!r.revealed || !event || !respondents.has(playerId)) continue;
          insertResponse(db, { respondentId: respondents.get(playerId), productId: r.productId, roundPosition: i + 1,
            prevPriceCents: i ? prices.get(room.rounds[i - 1].productId).priceCents : null, actualCents: prices.get(r.productId).priceCents,
            guessCents: cents(guess), maxPayCents, answeredAt: submittedAt });
          summary.responses += 1;
        }
      });
      summary.rooms += 1;
    }
    db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value').run('rooms_json_imported_at', importedAt);
  })();
  return summary;
}
