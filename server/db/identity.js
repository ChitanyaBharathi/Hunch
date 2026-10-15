import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { CONSENT_VERSION } from '../consent.js';

// Respondents are the pseudonymous research identity. The browser keeps a random key; we store only its hash,
// so the respondent id itself is never a credential.
const hashKey = key => createHash('sha256').update(`respondent:${key}`).digest('hex');

export function findOrCreateRespondent(db, key, { isSeed = false, createdAt = new Date().toISOString() } = {}) {
  if (typeof key === 'string' && /^[a-f0-9]{48}$/.test(key)) {
    const existing = db.prepare('SELECT id FROM respondents WHERE key_hash = ?').get(hashKey(key));
    if (existing) return { respondentId: existing.id, key, created: false };
  }
  const freshKey = randomBytes(24).toString('hex');
  const respondentId = randomUUID();
  db.prepare('INSERT INTO respondents (id, key_hash, created_at, is_seed) VALUES (?, ?, ?, ?)').run(respondentId, hashKey(freshKey), createdAt, isSeed ? 1 : 0);
  return { respondentId, key: freshKey, created: true };
}

// Issue a fresh browser key for an existing respondent (e.g. one imported without a key).
export function rekey(db, respondentId) {
  const key = randomBytes(24).toString('hex');
  db.prepare('UPDATE respondents SET key_hash = ? WHERE id = ?').run(hashKey(key), respondentId);
  return key;
}

export const linkPlayer = (db, playerId, respondentId) =>
  db.prepare('INSERT INTO player_respondent_link (player_id, respondent_id) VALUES (?, ?) ON CONFLICT (player_id) DO UPDATE SET respondent_id = excluded.respondent_id').run(playerId, respondentId);

export const respondentForPlayer = (db, playerId) =>
  db.prepare('SELECT respondent_id FROM player_respondent_link WHERE player_id = ?').pluck().get(playerId) ?? null;

export const activeConsent = (db, respondentId) =>
  db.prepare('SELECT * FROM consents WHERE respondent_id = ? AND withdrawn_at IS NULL ORDER BY granted_at DESC, id DESC LIMIT 1').get(respondentId) ?? null;

export function grantConsent(db, respondentId, { version, textHash, at = new Date().toISOString() }) {
  const current = activeConsent(db, respondentId);
  if (current?.consent_version === version) return current;
  if (current) db.prepare('UPDATE consents SET withdrawn_at = ? WHERE id = ?').run(at, current.id); // superseded by the new version
  db.prepare('INSERT INTO consents (respondent_id, consent_version, consent_text_hash, granted_at) VALUES (?, ?, ?, ?)').run(respondentId, version, textHash, at);
  return activeConsent(db, respondentId);
}

// Research status of a player: 'none' | 'outdated' (consented to an older text) | 'active'.
export function playerResearch(db, playerId) {
  const row = db.prepare(`SELECT l.respondent_id AS respondentId, r.profile_asked_at AS profileAskedAt, c.consent_version AS version, c.granted_at AS grantedAt, c.id AS consentId
    FROM player_respondent_link l JOIN respondents r ON r.id = l.respondent_id
    LEFT JOIN consents c ON c.id = (SELECT id FROM consents WHERE respondent_id = l.respondent_id AND withdrawn_at IS NULL ORDER BY granted_at DESC, id DESC LIMIT 1)
    WHERE l.player_id = ?`).get(playerId);
  if (!row?.version) return { status: 'none', respondentId: row?.respondentId ?? null, profileAsked: false };
  return { status: row.version === CONSENT_VERSION ? 'active' : 'outdated', respondentId: row.respondentId, consentId: row.consentId, grantedAt: row.grantedAt, profileAsked: Boolean(row.profileAskedAt) };
}

// Players in a room whose current-version consent is active right now, with when it was granted.
export function activeConsentsInRoom(db, roomId) {
  return new Map(db.prepare(`SELECT l.player_id AS playerId, l.respondent_id AS respondentId, c.id AS consentId, c.granted_at AS grantedAt
    FROM players p JOIN player_respondent_link l ON l.player_id = p.id
    JOIN consents c ON c.respondent_id = l.respondent_id AND c.withdrawn_at IS NULL AND c.consent_version = ?
    WHERE p.room_id = ?`).all(CONSENT_VERSION, roomId).map(r => [r.playerId, r]));
}

// Withdrawal: close the consent, delete every research response and every player link, and clear the profile.
// The respondent row and consent history remain as an audit record with no answers attached.
export function withdraw(db, respondentId, at = new Date().toISOString()) {
  return db.transaction(() => {
    db.prepare('UPDATE consents SET withdrawn_at = ? WHERE respondent_id = ? AND withdrawn_at IS NULL').run(at, respondentId);
    const deleted = db.prepare('DELETE FROM responses WHERE respondent_id = ?').run(respondentId).changes;
    db.prepare('DELETE FROM player_respondent_link WHERE respondent_id = ?').run(respondentId);
    db.prepare(`UPDATE respondents SET key_hash = NULL, age_band = NULL, gender = NULL, region = NULL, shops_online_freq = NULL,
      profile_asked_at = NULL WHERE id = ?`).run(respondentId);
    return deleted;
  })();
}

export function saveProfile(db, respondentId, { ageBand = null, gender = null, region = null, shopsOnlineFreq = null }, at = new Date().toISOString()) {
  db.prepare(`UPDATE respondents SET age_band = ?, gender = ?, region = ?, shops_online_freq = ?, profile_asked_at = ? WHERE id = ?`)
    .run(ageBand, gender, region, shopsOnlineFreq, at, respondentId);
}
