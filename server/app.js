import { networkInterfaces } from 'node:os';
import { send } from './http.js';
import { roomRoutes } from './routes/rooms.js';
import { insightsRoutes } from './routes/insights.js';
import { CONSENT_VERSION, CONSENT_TEXT, BUYER_CATEGORIES, PROFILE_OPTIONS } from './consent.js';

// One request handler for both the local server (server/index.js) and the Vercel function (api/index.js).
// `getDb` returns the shared database promise, opened once per process.
export function createHandler(getDb) {
  return async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const path = url.pathname;
      if (path === '/api/health') return send(res, 200, { ok: true });
      if (path === '/api/consent' && req.method === 'GET') return send(res, 200, { version: CONSENT_VERSION, text: CONSENT_TEXT, buyerCategories: BUYER_CATEGORIES, profileOptions: PROFILE_OPTIONS });
      if (path === '/api/network') {
        // Only meaningful on a laptop hosting a Wi-Fi game; hosted deployments have nothing to share.
        if (process.env.VERCEL) return send(res, 200, { hosts: [] });
        const hosts = Object.entries(networkInterfaces()).sort(([a], [b]) => Number(/wi-fi|wlan/i.test(b)) - Number(/wi-fi|wlan/i.test(a)))
          .flatMap(([, addresses]) => addresses.filter(a => a.family === 'IPv4' && !a.internal).map(a => a.address));
        return send(res, 200, { hosts });
      }
      const db = await getDb();
      if (await roomRoutes(db, req, res, path)) return undefined;
      if (await insightsRoutes(db, req, res, path)) return undefined;
      return send(res, 404, { error: 'Not found.' });
    } catch (error) {
      if (!error.status) console.error(error);
      return send(res, error.status || 500, { error: error.status ? error.message : 'The game server had a problem. Try again.' });
    }
  };
}
