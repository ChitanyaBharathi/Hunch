import { send, sendCsv, readBody, bearer, clientIp, fail } from '../http.js';
import { rateLimiter } from '../rateLimit.js';
import { signSession, verifySession, newLinkToken, hashLinkToken } from '../auth.js';
import * as biz from '../db/business.js';
import { studyReport, reportCsv } from '../insightsReport.js';

const SESSION_MS = 12 * 60 * 60 * 1000;
const LINK_MS = 15 * 60 * 1000;
const loginByIp = rateLimiter({ limit: 10, windowMs: 15 * 60_000 });
const loginByEmail = rateLimiter({ limit: 5, windowMs: 15 * 60_000 });
const verifyByIp = rateLimiter({ limit: 20, windowMs: 15 * 60_000 });
export const cleanEmail = value => (typeof value === 'string' && /^[^\s@]{1,64}@[^\s@]{1,190}$/.test(value.trim()) ? value.trim().toLowerCase() : fail('Enter a valid email address.'));

// Where sign-in links point. Defaults to the Vite dev server; set HUNCH_PUBLIC_URL when serving elsewhere.
const publicUrl = req => process.env.HUNCH_PUBLIC_URL || (/^https?:\/\/[\w.:-]+$/.test(req.headers.origin ?? '') ? req.headers.origin : 'http://localhost:5173');

const prototypeOpen = () => process.env.NODE_ENV !== 'production' && process.env.HUNCH_PROTOTYPE !== 'off';

async function companyUser(db, req) {
  const session = verifySession(bearer(req), 'company');
  const user = await biz.userById(db, session.uid);
  if (!user || user.companyId !== session.cid) fail('Sign in to continue.', 401);
  return user;
}

export async function insightsRoutes(db, req, res, path) {
  if (!path.startsWith('/api/insights/')) return false;
  if (path === '/api/insights/login' && req.method === 'POST') {
    loginByIp(`login:${clientIp(req)}`);
    const email = cleanEmail((await readBody(req)).email);
    loginByEmail(`login:${email}`);
    const user = await biz.userByEmail(db, email);
    if (user) {
      const token = newLinkToken();
      await biz.setMagicLink(db, user.id, hashLinkToken(token), new Date(Date.now() + LINK_MS).toISOString());
      // Local development has no mail server, so the link is printed for the operator to pass on.
      console.log(`[Hunch Insights] Sign-in link for ${email} (works once, 15 minutes): ${publicUrl(req)}/insights?token=${token}`);
    }
    // Same answer either way, so the form never reveals which emails have accounts.
    send(res, 200, { ok: true, message: 'If that email has access, a sign-in link is on its way. It works once and expires in 15 minutes.' });
    return true;
  }
  if (path === '/api/insights/session' && req.method === 'POST') {
    verifyByIp(`verify:${clientIp(req)}`);
    const { token } = await readBody(req);
    const userId = typeof token === 'string' && /^[a-f0-9]{64}$/.test(token) ? await biz.consumeMagicLink(db, hashLinkToken(token), new Date().toISOString()) : null;
    if (!userId) fail('This sign-in link has expired or was already used. Request a new one.', 401);
    const user = await biz.userById(db, userId);
    send(res, 200, { session: signSession({ kind: 'company', uid: user.id, cid: user.companyId }, SESSION_MS), user: { email: user.email, company: user.companyName } });
    return true;
  }
  // Prototype shortcut: pick a company and go straight in, no email. Off in production.
  if (path === '/api/insights/prototype' && req.method === 'GET') {
    if (!prototypeOpen()) fail('Not found.', 404);
    send(res, 200, (await biz.companies(db)).map(c => ({ id: c.id, name: c.name })));
    return true;
  }
  if (path === '/api/insights/prototype' && req.method === 'POST') {
    if (!prototypeOpen()) fail('Not found.', 404);
    const { companyId } = await readBody(req);
    if (!Number.isInteger(companyId) || !(await biz.companyExists(db, companyId))) fail('Choose a company.');
    let userId = await db.prepare('SELECT id FROM company_users WHERE company_id = ? ORDER BY id LIMIT 1').pluck().get(companyId);
    if (!userId) { await biz.addCompanyUser(db, companyId, `prototype+${companyId}@hunch.local`); userId = await db.prepare('SELECT id FROM company_users WHERE company_id = ? ORDER BY id LIMIT 1').pluck().get(companyId); }
    const user = await biz.userById(db, userId);
    send(res, 200, { session: signSession({ kind: 'company', uid: user.id, cid: user.companyId }, SESSION_MS), user: { email: user.email, company: user.companyName } });
    return true;
  }
  if (req.method !== 'GET') { send(res, 405, { error: 'Method not allowed.' }); return true; }
  const user = await companyUser(db, req);
  if (path === '/api/insights/me') { send(res, 200, { email: user.email, company: user.companyName }); return true; }
  if (path === '/api/insights/studies') {
    const studies = await biz.studiesForCompany(db, user.companyId);
    send(res, 200, await Promise.all(studies.map(async ({ productIds, ...s }) => ({ ...s, products: productIds.length, ...(await biz.studyCounts(db, { ...s, productIds })) }))));
    return true;
  }
  const match = path.match(/^\/api\/insights\/studies\/(\d+)\/report(\.csv)?$/);
  if (!match) return false;
  const study = await biz.studyById(db, Number(match[1]));
  // Tenant isolation: another company's study looks exactly like a missing one.
  if (!study || study.companyId !== user.companyId || study.status === 'draft') fail('Study not found.', 404);
  const report = await studyReport(db, study);
  await biz.logAccess(db, { userId: user.id, studyId: study.id, exported: Boolean(match[2]) });
  if (match[2]) sendCsv(res, `hunch-insights-study-${study.id}.csv`, reportCsv(report));
  else send(res, 200, report);
  return true;
}
