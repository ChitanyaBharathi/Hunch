// Every /api/* request on Vercel is rewritten here (vercel.json) with the original path in ?__path=, and goes
// through the same handler as the local server. The database is opened once per warm instance and reused.
import '../server/env.js';
import { openDb, defaultTarget } from '../server/db/index.js';
import { createHandler } from '../server/app.js';

let ready;
const getDb = () => (ready ??= openDb(defaultTarget()).catch(error => { ready = undefined; throw error; }));
const handle = createHandler(getDb);

export default function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const original = url.searchParams.get('__path');
  if (original !== null) {
    url.searchParams.delete('__path');
    req.url = `/api/${original}${url.search}`;
  }
  return handle(req, res);
}
