import './env.js';
import { createServer } from 'node:http';
import { openDb, defaultTarget } from './db/index.js';
import { createHandler } from './app.js';

const ready = openDb(defaultTarget());
const server = createServer(createHandler(() => ready));
ready.then(() => server.listen(Number(process.env.GAME_PORT || 3001), '127.0.0.1',
  () => console.log(`Game server ready on http://127.0.0.1:${server.address().port}${process.env.DATABASE_URL ? ' (Postgres)' : ' (local PGlite)'}`)));
