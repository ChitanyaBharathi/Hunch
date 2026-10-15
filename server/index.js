import './env.js';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { openDb, DEFAULT_DB_FILE } from './db/index.js';
import { send } from './http.js';
import { roomRoutes } from './routes/rooms.js';
import { insightsRoutes } from './routes/insights.js';
import { CONSENT_VERSION, CONSENT_TEXT, BUYER_CATEGORIES, PROFILE_OPTIONS } from './consent.js';

const db = openDb(process.env.GAME_EPHEMERAL === '1' ? ':memory:' : process.env.HUNCH_DB || DEFAULT_DB_FILE);

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;
    if (path === '/api/health') return send(res, 200, { ok: true });
    if (path === '/api/consent' && req.method === 'GET') return send(res, 200, { version: CONSENT_VERSION, text: CONSENT_TEXT, buyerCategories: BUYER_CATEGORIES, profileOptions: PROFILE_OPTIONS });
    if (path === '/api/network') {
      const hosts = Object.entries(networkInterfaces()).sort(([a], [b]) => Number(/wi-fi|wlan/i.test(b)) - Number(/wi-fi|wlan/i.test(a)))
        .flatMap(([, addresses]) => addresses.filter(a => a.family === 'IPv4' && !a.internal).map(a => a.address));
      return send(res, 200, { hosts });
    }
    if (await roomRoutes(db, req, res, path)) return undefined;
    if (await insightsRoutes(db, req, res, path)) return undefined;
    return send(res, 404, { error: 'Not found.' });
  } catch (error) {
    if (!error.status) console.error(error);
    return send(res, error.status || 500, { error: error.status ? error.message : 'The game server had a problem. Try again.' });
  }
});
server.listen(Number(process.env.GAME_PORT || 3001), '127.0.0.1', () => console.log(`Game server ready on http://127.0.0.1:${server.address().port}`));
