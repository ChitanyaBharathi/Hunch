import Database from 'better-sqlite3';
import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedCatalog } from './catalog.js';

const migrationsDir = fileURLToPath(new URL('./migrations/', import.meta.url));
export const DEFAULT_DB_FILE = fileURLToPath(new URL('../../.game-data/hunch.db', import.meta.url));

// Numbered files (001_init.sql, 002_...) applied once each, in order, inside a transaction.
export function migrate(db) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const applied = new Set(db.prepare('SELECT version FROM schema_migrations').pluck().all());
  for (const file of readdirSync(migrationsDir).filter(f => /^\d+_.+\.sql$/.test(f)).sort()) {
    if (applied.has(file)) continue;
    db.transaction(() => {
      db.exec(readFileSync(`${migrationsDir}${file}`, 'utf8'));
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(file, new Date().toISOString());
    })();
  }
}

// ':memory:' gives an isolated database for tests and GAME_EPHEMERAL runs.
export function openDb(file = ':memory:') {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new Database(file);
  if (file !== ':memory:') db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  seedCatalog(db);
  return db;
}
