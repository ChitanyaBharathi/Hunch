// Every /api/* request on Vercel lands here and goes through the same handler as the local server.
// The database is opened once per warm function instance and reused across requests.
import '../server/env.js';
import { openDb, defaultTarget } from '../server/db/index.js';
import { createHandler } from '../server/app.js';

let ready;
const getDb = () => (ready ??= openDb(defaultTarget()).catch(error => { ready = undefined; throw error; }));

export default createHandler(getDb);
