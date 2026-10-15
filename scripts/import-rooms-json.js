// One-time move of .game-data/rooms.json into the database. Safe to re-run: existing rooms are skipped.
// rooms.json is left untouched as a backup; the server no longer reads it.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openDb, defaultTarget } from '../server/db/index.js';
import { importRooms } from '../server/db/importRooms.js';

try { process.loadEnvFile(); } catch { /* optional */ }
const source = process.argv[2] ?? fileURLToPath(new URL('../.game-data/rooms.json', import.meta.url));
const db = await openDb(defaultTarget());
const summary = await importRooms(db, JSON.parse(readFileSync(source, 'utf8')));
console.log(`Imported from ${source}:`, summary);
await db.close();
