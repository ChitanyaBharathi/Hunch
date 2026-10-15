// Companies, studies, company users and the report access log.

const STUDY = `s.id, s.company_id AS companyId, s.title, s.starts_on AS startsOn, s.ends_on AS endsOn, s.min_responses AS minResponses, s.status,
  (SELECT COALESCE(json_agg(product_id ORDER BY product_id), '[]'::json) FROM study_products WHERE study_id = s.id) AS productIds`;
const list = v => (typeof v === 'string' ? JSON.parse(v) : v ?? []);
const parseStudy = row => (row ? { ...row, productIds: list(row.productIds) } : null);

// ── Company users and magic links ────────────────────────────────────────────
export const userByEmail = (db, email) => db.prepare('SELECT id, company_id AS companyId, email FROM company_users WHERE email = ?').get(email);
export const userById = (db, id) => db.prepare(`SELECT u.id, u.email, u.company_id AS companyId, c.name AS companyName, u.last_login_at AS lastLoginAt
  FROM company_users u JOIN companies c ON c.id = u.company_id WHERE u.id = ?`).get(id);
export const setMagicLink = (db, userId, tokenHash, expiresAt) =>
  db.prepare('UPDATE company_users SET magic_link_token_hash = ?, magic_link_expires_at = ? WHERE id = ?').run(tokenHash, expiresAt, userId);
// One use only: the hash is cleared as the link is consumed.
export async function consumeMagicLink(db, tokenHash, now) {
  return db.transaction(async () => {
    const user = await db.prepare('SELECT id FROM company_users WHERE magic_link_token_hash = ? AND magic_link_expires_at > ?').get(tokenHash, now);
    if (!user) return null;
    await db.prepare('UPDATE company_users SET magic_link_token_hash = NULL, magic_link_expires_at = NULL, last_login_at = ? WHERE id = ?').run(now, user.id);
    return user.id;
  })();
}

// ── Studies ──────────────────────────────────────────────────────────────────
export const studiesForCompany = async (db, companyId) =>
  (await db.prepare(`SELECT ${STUDY} FROM studies s WHERE s.company_id = ? AND s.status != 'draft' ORDER BY s.starts_on DESC`).all(companyId)).map(parseStudy);
export const studyById = async (db, id) => parseStudy(await db.prepare(`SELECT ${STUDY} FROM studies s WHERE s.id = ?`).get(id));
export const allStudies = async db => (await db.prepare(`SELECT ${STUDY}, c.name AS companyName FROM studies s JOIN companies c ON c.id = s.company_id ORDER BY s.id DESC`).all()).map(parseStudy);

// Responses and distinct respondents inside the study's products and dates.
export async function studyCounts(db, study) {
  return db.prepare(`SELECT COUNT(*) AS responses, COUNT(DISTINCT respondent_id) AS respondents FROM responses
    WHERE product_id IN (SELECT json_array_elements_text(?::json)) AND substr(answered_at, 1, 10) BETWEEN ? AND ?`)
    .get(JSON.stringify(study.productIds), study.startsOn, study.endsOn);
}

export async function saveStudy(db, { id, companyId, title, startsOn, endsOn, minResponses = 30, status = 'draft', productIds = [] }) {
  return db.transaction(async () => {
    const studyId = id
      ? (await db.prepare('UPDATE studies SET company_id = ?, title = ?, starts_on = ?, ends_on = ?, min_responses = ?, status = ? WHERE id = ?')
        .run(companyId, title, startsOn, endsOn, minResponses, status, id), id)
      : (await db.prepare('INSERT INTO studies (company_id, title, starts_on, ends_on, min_responses, status) VALUES (?, ?, ?, ?, ?, ?)')
        .run(companyId, title, startsOn, endsOn, minResponses, status)).lastInsertRowid;
    await db.prepare('DELETE FROM study_products WHERE study_id = ?').run(studyId);
    for (const productId of new Set(productIds)) await db.prepare('INSERT INTO study_products (study_id, product_id) VALUES (?, ?)').run(studyId, productId);
    return Number(studyId);
  })();
}

// ── Companies ────────────────────────────────────────────────────────────────
export const companies = async db => (await db.prepare(`SELECT c.id, c.name, c.contact_email AS contactEmail, c.created_at AS createdAt, c.is_seed AS isSeed,
  (SELECT COALESCE(json_agg(email ORDER BY email), '[]'::json) FROM company_users WHERE company_id = c.id) AS users FROM companies c ORDER BY c.name`).all())
  .map(c => ({ ...c, users: list(c.users) }));
export const createCompany = async (db, { name, contactEmail, isSeed = false, createdAt = new Date().toISOString() }) =>
  Number((await db.prepare('INSERT INTO companies (name, contact_email, created_at, is_seed) VALUES (?, ?, ?, ?)').run(name, contactEmail || null, createdAt, isSeed ? 1 : 0)).lastInsertRowid);
export const addCompanyUser = async (db, companyId, email) =>
  Number((await db.prepare('INSERT INTO company_users (company_id, email) VALUES (?, ?)').run(companyId, email)).lastInsertRowid);
export const companyExists = async (db, id) => Boolean(await db.prepare('SELECT 1 FROM companies WHERE id = ?').get(id));

// ── Access log ───────────────────────────────────────────────────────────────
export const logAccess = (db, { userId, studyId, exported = false, at = new Date().toISOString() }) =>
  db.prepare('INSERT INTO report_access_log (company_user_id, study_id, viewed_at, exported) VALUES (?, ?, ?, ?)').run(userId, studyId, at, exported ? 1 : 0);
export const accessLog = (db, limit = 100) => db.prepare(`SELECT l.viewed_at AS viewedAt, l.exported, u.email, s.title AS study
  FROM report_access_log l LEFT JOIN company_users u ON u.id = l.company_user_id LEFT JOIN studies s ON s.id = l.study_id ORDER BY l.id DESC LIMIT ?`).all(limit);
