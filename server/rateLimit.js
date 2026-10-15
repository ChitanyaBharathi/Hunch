import { fail } from './http.js';

// Fixed-window limiter kept in memory: fine for one local server. Keys are usually "route:ip" or "route:ip:email".
export function rateLimiter({ limit, windowMs }) {
  const hits = new Map();
  return key => {
    const at = Date.now();
    const entry = hits.get(key);
    if (!entry || at - entry.start >= windowMs) {
      hits.set(key, { start: at, count: 1 });
      if (hits.size > 10000) for (const [k, v] of hits) if (at - v.start >= windowMs) hits.delete(k);
      return;
    }
    entry.count += 1;
    if (entry.count > limit) fail(`Too many attempts. Try again in ${Math.ceil((windowMs - (at - entry.start)) / 60000)} minute(s).`, 429);
  };
}
