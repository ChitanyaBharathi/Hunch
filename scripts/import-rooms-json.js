// One-time move of .game-data/rooms.json into .game-data/hunch.db. Safe to re-run: existing rooms are skipped.
// rooms.json is left untouched as a backup; the server no longer reads it.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openDb, DEFAULT_DB_FILE } from '../server/db/index.js';
import { importRooms } from '../server/db/importRooms.js';

try { process.loadEnvFile(); } catch { /* optional */ }
const source = process.argv[2] ?? fileURLToPath(new URL('../.game-data/rooms.json', import.meta.url));
const db = openDb(process.env.HUNCH_DB || DEFAULT_DB_FILE);
const summary = importRooms(db, JSON.parse(readFileSync(source, 'utf8')));
console.log(`Imported from ${source}:`, summary);
db.close();
