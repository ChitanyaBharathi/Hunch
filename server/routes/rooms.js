import { createRoom, findRoom, joinRoom, authenticate, applyAction, snapshot } from '../game.js';
import { send, sendCsv, readBody, bearer, clientIp } from '../http.js';
import { rateLimiter } from '../rateLimit.js';
import { roomReport, reportCsv } from '../insightsReport.js';

const joinLimit = rateLimiter({ limit: 30, windowMs: 60_000 });
const research = body => ({ researchConsent: body.researchConsent, ageConfirmed: body.ageConfirmed, respondentKey: body.respondentKey });

export async function roomRoutes(db, req, res, path) {
  const match = path.match(/^\/api\/rooms(?:\/([A-Z0-9]{6})(?:\/(join|start|guess|reveal|next|end|consent|profile|insights|insights\.csv))?)?$/i);
  if (!match) return false;
  const [, code, action] = match;
  if (req.method === 'POST' && !code) {
    joinLimit(`create:${clientIp(req)}`);
    const body = await readBody(req);
    const created = await createRoom(db, body.name, research(body), { mode: body.mode ?? 'party', lobby: true });
    const room = await findRoom(db, created.code);
    send(res, 201, { session: { code: created.code, token: created.token }, respondentKey: created.respondentKey, room: await snapshot(db, room, created.player) });
    return true;
  }
  if (req.method === 'POST' && action === 'join') {
    joinLimit(`join:${clientIp(req)}`);
    const body = await readBody(req);
    const joined = await joinRoom(db, code, body.name, research(body));
    send(res, 201, { session: { code: joined.code, token: joined.token }, respondentKey: joined.respondentKey, room: await snapshot(db, await findRoom(db, code), joined.player) });
    return true;
  }
  const { room, player } = await authenticate(db, code, bearer(req));
  if (req.method === 'GET' && (action === 'insights' || action === 'insights.csv')) {
    if (player.id !== room.hostId) { send(res, 403, { error: 'Only the host can access research reports.' }); return true; }
    const report = await roomReport(db, room);
    if (action === 'insights') send(res, 200, report);
    else sendCsv(res, 'hunch-room-insights.csv', reportCsv(report));
    return true;
  }
  if (req.method === 'GET' && !action) { send(res, 200, await snapshot(db, room, player)); return true; }
  if (req.method === 'POST' && action) {
    const extra = await applyAction(db, room, player, action, await readBody(req));
    send(res, 200, { ...(await snapshot(db, await findRoom(db, code), player)), ...(extra?.respondentKey ? { respondentKey: extra.respondentKey } : {}) });
    return true;
  }
  send(res, 405, { error: 'Method not allowed.' });
  return true;
}
