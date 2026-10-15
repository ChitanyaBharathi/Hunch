import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Db } from './pg.js';
import { seedCatalog } from './catalog.js';

const migrationsDir = fileURLToPath(new URL('./migrations/', import.meta.url));
// Local play without DATABASE_URL keeps its data here (PGlite: Postgres running inside Node).
export const DEFAULT_DB_DIR = fileURLToPath(new URL('../../.game-data/pg', import.meta.url));
// Counts and sums come back from Postgres as strings; the app expects numbers.
const NUMBER_TYPES = [20, 1700]; // int8, numeric

// Numbered files (001_schema.sql, 002_...) applied once each, in order, inside a transaction.
export async function migrate(db) {
  await db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const applied = new Set(await db.prepare('SELECT version FROM schema_migrations').pluck().all());
  for (const file of readdirSync(migrationsDir).filter(f => /^\d+_.+\.sql$/.test(f)).sort()) {
    if (applied.has(file)) continue;
    await db.transaction(async () => {
      await db.exec(readFileSync(`${migrationsDir}${file}`, 'utf8'));
      await db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(file, new Date().toISOString());
    })();
  }
}

async function postgres(url) {
  const { default: pg } = await import('pg');
  for (const oid of NUMBER_TYPES) pg.types.setTypeParser(oid, Number);
  // Supabase's pooler serves a certificate Node doesn't chain by default; the connection is still encrypted.
  const pool = new pg.Pool({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false }, max: 5 });
  return new Db({
    query: (text, params) => pool.query(text, params),
    exec: sql => pool.query(sql),
    connect: async () => { const client = await pool.connect(); return { query: (t, p) => client.query(t, p), exec: s => client.query(s), release: () => client.release() }; },
    close: () => pool.end(),
  });
}

const parsers = Object.fromEntries(NUMBER_TYPES.map(oid => [oid, Number]));
const wrapLite = lite => {
  const client = { query: (t, p) => lite.query(t, p, { parsers }), exec: s => lite.exec(s) };
  return Object.assign(new Db({ ...client, connect: async () => client, close: () => lite.close(), serial: true }), { lite });
};

async function pglite(dir) {
  const { PGlite } = await import('@electric-sql/pglite');
  if (dir) mkdirSync(dir, { recursive: true });
  return wrapLite(await PGlite.create(dir ? { dataDir: dir, parsers } : { parsers }));
}

// Tests: an independent copy of an already migrated and seeded in-memory database, in milliseconds.
export const cloneDb = async db => wrapLite(await db.lite.clone());

// DATABASE_URL → Supabase/Postgres. Otherwise PGlite: in memory for tests (`':memory:'`), or a local folder.
export async function openDb(target = ':memory:', { seed = true } = {}) {
  const db = /^postgres(ql)?:\/\//.test(target) ? await postgres(target) : await pglite(target === ':memory:' ? null : target);
  await migrate(db);
  if (seed) await seedCatalog(db);
  return db;
}

// Tests always win over .env: GAME_EPHEMERAL (in-memory) or HUNCH_DB (a throwaway folder) beat DATABASE_URL,
// so a test run can never touch the real database.
export const defaultTarget = () => (process.env.GAME_EPHEMERAL === '1' ? ':memory:' : process.env.HUNCH_DB || process.env.DATABASE_URL || DEFAULT_DB_DIR);
