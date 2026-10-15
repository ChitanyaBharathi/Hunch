import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { fail } from './http.js';

// Signed, expiring session tokens for company users and the admin: base64url(payload).base64url(HMAC-SHA256).
// HUNCH_SESSION_SECRET comes from .env; without it a random secret is used and sessions end when the server restarts.
let secret;
export function sessionSecret() {
  secret ??= process.env.HUNCH_SESSION_SECRET;
  if (!secret) {
    secret = randomBytes(32).toString('hex');
    if (process.env.GAME_EPHEMERAL !== '1') console.warn('HUNCH_SESSION_SECRET is not set: using a temporary secret. Company and admin sessions end on restart.');
  }
  return secret;
}

const b64 = value => Buffer.from(value).toString('base64url');
const mac = body => createHmac('sha256', sessionSecret()).update(body).digest();

export function signSession(payload, ttlMs) {
  const body = b64(JSON.stringify({ ...payload, exp: Date.now() + ttlMs }));
  return `${body}.${mac(body).toString('base64url')}`;
}

export function verifySession(token, kind) {
  const [body, signature] = String(token ?? '').split('.');
  if (!body || !signature) fail('Sign in to continue.', 401);
  const expected = mac(body);
  const given = Buffer.from(signature, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) fail('Sign in to continue.', 401);
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (payload.kind !== kind || !(payload.exp > Date.now())) fail('Your session has expired. Sign in again.', 401);
  return payload;
}

export const newLinkToken = () => randomBytes(32).toString('hex');
export const hashLinkToken = token => createHash('sha256').update(`magic:${token}`).digest('hex');

// Constant-time password check against the .env value.
export function passwordMatches(given, expected) {
  if (!expected) return false;
  const a = createHash('sha256').update(String(given ?? '')).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}
