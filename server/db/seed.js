import { randomUUID } from 'node:crypto';
import { insertResponse } from './research.js';
import { createCompany, addCompanyUser, saveStudy } from './business.js';
import { CONSENT_VERSION, CONSENT_TEXT_HASH } from '../consent.js';

// Every seeded row has is_seed = 1 (respondents, responses, companies; studies and users cascade from the company),
// so removeSeed() takes the demo out in one go without touching real data.
export const DEMO_EMAIL = 'demo@hunch.local';

export function insertSeed(db, { respondents, responses }, { study } = {}) {
  return db.transaction(() => {
    const ids = new Map();
    const respondent = db.prepare(`INSERT INTO respondents (id, created_at, age_band, gender, region, shops_online_freq, profile_asked_at, is_seed)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)`);
    const consent = db.prepare('INSERT INTO consents (respondent_id, consent_version, consent_text_hash, granted_at) VALUES (?, ?, ?, ?)');
    const first = new Map();
    for (const r of responses) if (!first.has(r.respondentId) || r.answeredAt < first.get(r.respondentId)) first.set(r.respondentId, r.answeredAt);
    for (const r of respondents) {
      const id = randomUUID();
      ids.set(r.id, id);
      const at = first.get(r.id) ?? new Date().toISOString();
      respondent.run(id, at, r.ageBand, r.gender, r.region, r.shopsOnlineFreq, at);
      consent.run(id, CONSENT_VERSION, CONSENT_TEXT_HASH, at);
    }
    for (const r of responses) insertResponse(db, { ...r, respondentId: ids.get(r.respondentId), isSeed: true });
    let studyId = null;
    if (study) {
      const companyId = createCompany(db, { name: study.company, contactEmail: DEMO_EMAIL, isSeed: true });
      addCompanyUser(db, companyId, DEMO_EMAIL);
      studyId = saveStudy(db, { companyId, title: study.title, startsOn: study.startsOn, endsOn: study.endsOn, minResponses: 1500, status: 'active', productIds: study.productIds });
    }
    return { respondents: respondents.length, responses: responses.length, studyId };
  })();
}

export function removeSeed(db) {
  return db.transaction(() => {
    const responses = db.prepare('DELETE FROM responses WHERE is_seed = 1').run().changes;
    db.prepare('DELETE FROM consents WHERE respondent_id IN (SELECT id FROM respondents WHERE is_seed = 1)').run();
    db.prepare('DELETE FROM player_respondent_link WHERE respondent_id IN (SELECT id FROM respondents WHERE is_seed = 1)').run();
    const respondents = db.prepare('DELETE FROM respondents WHERE is_seed = 1').run().changes;
    const companies = db.prepare('DELETE FROM companies WHERE is_seed = 1').run().changes;
    return { responses, respondents, companies };
  })();
}

export const seedCount = db => db.prepare('SELECT COUNT(*) FROM respondents WHERE is_seed = 1').pluck().get();
