import { send, sendCsv, readBody, bearer, clientIp, fail } from '../http.js';
import { rateLimiter } from '../rateLimit.js';
import { signSession, verifySession, newLinkToken, hashLinkToken } from '../auth.js';
import * as biz from '../db/business.js';
import { studyReport, reportCsv } from '../insightsReport.js';
import { runAnalyst } from '../agent/analyst.js';
import { geminiEnabled, geminiModel } from '../agent/gemini.js';

const SESSION_MS = 12 * 60 * 60 * 1000;
const LINK_MS = 15 * 60 * 1000;
const loginByIp = rateLimiter({ limit: 10, windowMs: 15 * 60_000 });
const loginByEmail = rateLimiter({ limit: 5, windowMs: 15 * 60_000 });
const verifyByIp = rateLimiter({ limit: 20, windowMs: 15 * 60_000 });
const askLimit = rateLimiter({ limit: 20, windowMs: 15 * 60_000 }); // AI analyst questions per company user
export const cleanEmail = value => (typeof value === 'string' && /^[^\s@]{1,64}@[^\s@]{1,190}$/.test(value.trim()) ? value.trim().toLowerCase() : fail('Enter a valid email address.'));

// Where sign-in links point. Defaults to the Vite dev server; set HUNCH_PUBLIC_URL when serving elsewhere.
const publicUrl = req => process.env.HUNCH_PUBLIC_URL || (/^https?:\/\/[\w.:-]+$/.test(req.headers.origin ?? '') ? req.headers.origin : 'http://localhost:5173');

// No-login company picker for the prototype. Off in production unless HUNCH_PROTOTYPE=on; HUNCH_PROTOTYPE=off disables it anywhere.
const prototypeOpen = () => process.env.HUNCH_PROTOTYPE === 'on' || (process.env.NODE_ENV !== 'production' && process.env.HUNCH_PROTOTYPE !== 'off');

async function companyUser(db, req) {
  const session = verifySession(bearer(req), 'company');
  const user = await biz.userById(db, session.uid);
  if (!user || user.companyId !== session.cid) fail('Sign in to continue.', 401);
  return user;
}

// Tenant isolation: another company's study looks exactly like a missing one.
async function ownStudy(db, user, id) {
  const study = await biz.studyById(db, id);
  if (!study || study.companyId !== user.companyId || study.status === 'draft') fail('Study not found.', 404);
  return study;
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
  const ask = path.match(/^\/api\/insights\/studies\/(\d+)\/ask$/);
  if (ask && req.method === 'POST') {
    const user = await companyUser(db, req);
    askLimit(`ask:${user.id}`);
    if (!geminiEnabled()) fail('The AI analyst is not set up yet. Add GEMINI_API_KEY to .env and restart the server.', 503);
    const { question, history } = await readBody(req, 16384);
    const text = typeof question === 'string' ? question.trim() : '';
    if (!text || text.length > 500) fail('Ask a question of up to 500 characters.');
    const turns = (Array.isArray(history) ? history : []).slice(-6)
      .filter(t => (t?.role === 'user' || t?.role === 'model') && typeof t.text === 'string').map(t => ({ role: t.role, text: t.text.slice(0, 2000) }));
    const study = await ownStudy(db, user, Number(ask[1]));
    const report = await studyReport(db, study);
    await biz.logAccess(db, { userId: user.id, studyId: study.id, exported: false });
    // Stream each step as a line of JSON so the portal can show the agent working.
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
    const emit = event => res.write(`${JSON.stringify(event)}\n`);
    try { await runAnalyst({ report, question: text, history: turns, onEvent: emit }); }
    catch (error) {
      if (!error.status) console.error(error);
      emit({ type: 'error', error: error.status ? error.message : 'The AI analyst had a problem. Try again.' });
    }
    res.end();
    return true;
  }
  if (req.method !== 'GET') { send(res, 405, { error: 'Method not allowed.' }); return true; }
  const user = await companyUser(db, req);
  if (path === '/api/insights/me') { send(res, 200, { email: user.email, company: user.companyName }); return true; }
  if (path === '/api/insights/agent') { send(res, 200, { enabled: geminiEnabled(), model: geminiModel() }); return true; }
  if (path === '/api/insights/studies') {
    const studies = await biz.studiesForCompany(db, user.companyId);
    send(res, 200, await Promise.all(studies.map(async ({ productIds, ...s }) => ({ ...s, products: productIds.length, ...(await biz.studyCounts(db, { ...s, productIds })) }))));
    return true;
  }
  const match = path.match(/^\/api\/insights\/studies\/(\d+)\/report(\.csv)?$/);
  if (!match) return false;
  const study = await ownStudy(db, user, Number(match[1]));
  const report = await studyReport(db, study);
  await biz.logAccess(db, { userId: user.id, studyId: study.id, exported: Boolean(match[2]) });
  if (match[2]) sendCsv(res, `hunch-insights-study-${study.id}.csv`, reportCsv(report));
  else send(res, 200, report);
  return true;
}
