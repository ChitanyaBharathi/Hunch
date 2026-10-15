export const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };

export function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

export function sendCsv(res, filename, text) {
  res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Disposition': `attachment; filename="${filename}"` });
  res.end(text);
}

export async function readBody(req, limit = 4096) {
  // Vercel may already have parsed the body; locally it is still an unread stream.
  if (req.body !== undefined && req.body !== null) {
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (raw.length > limit) fail('Request too large.', 413);
    try { return JSON.parse(raw || '{}'); } catch { return fail('Invalid request.'); }
  }
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (text.length > limit) fail('Request too large.', 413);
  }
  try { return JSON.parse(text || '{}'); } catch { return fail('Invalid request.'); }
}

const isLoopback = address => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address);

// The Vite dev proxy forwards with X-Forwarded-For; trust that header only when the socket itself is local.
export function clientIp(req) {
  // On Vercel the socket is Vercel's proxy; it sets x-forwarded-for to the real client, first entry.
  if (process.env.VERCEL) return String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || 'unknown';
  const socket = req.socket.remoteAddress ?? '';
  const forwarded = String(req.headers['x-forwarded-for'] ?? '').split(',').map(s => s.trim()).filter(Boolean);
  return isLoopback(socket) && forwarded.length ? forwarded.at(-1) : socket;
}
export const isLocalRequest = req => isLoopback(clientIp(req));

export const bearer = req => String(req.headers.authorization ?? '').replace(/^Bearer /, '');
