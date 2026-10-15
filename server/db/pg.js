// A small async adapter that keeps the call style the data layer was written in:
//   await db.prepare(sql).get(...) / .all(...) / .run(...) / .pluck()   and   await db.transaction(fn)()
// It runs on Postgres: Supabase (via `pg`) in production, PGlite (Postgres in-process) for tests and local play.
// SQL is written SQLite-style; prepare() translates the few differences:
//   ?  and  @name  placeholders  →  $1, $2 …
//   AS camelCase  →  AS "camelCase"  (Postgres would otherwise lowercase the alias)
//   INSERT without RETURNING  →  RETURNING *, so .run() can report lastInsertRowid like SQLite did
import { AsyncLocalStorage } from 'node:async_hooks';

const txStore = new AsyncLocalStorage();

function translate(sql) {
  const names = [];
  let positional = 0;
  let text = sql.replace(/'(?:[^']|'')*'|@([A-Za-z_]\w*)|\?/g, (match, name) => {
    if (match.startsWith("'")) return match;
    if (name) {
      let i = names.indexOf(name);
      if (i < 0) { names.push(name); i = names.length - 1; }
      return `$${i + 1}`;
    }
    positional += 1;
    return `$${positional}`;
  });
  text = text.replace(/\bAS\s+([a-z]\w*[A-Z]\w*)\b/g, 'AS "$1"');
  const isInsert = /^\s*INSERT\b/i.test(text) && !/\bRETURNING\b/i.test(text);
  if (isInsert) text = `${text.trimEnd().replace(/;$/, '')} RETURNING *`;
  return { text, names, positional, isInsert };
}

const clean = v => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v);

class Statement {
  constructor(db, sql) { this.db = db; this.sql = translate(sql); this.plucked = false; }
  pluck() { this.plucked = true; return this; }
  values(params) {
    if (this.sql.names.length) { const named = params[0] ?? {}; return this.sql.names.map(n => clean(named[n])); }
    return params.slice(0, this.sql.positional).map(clean);
  }
  async rows(params) { return (await this.db.query(this.sql.text, this.values(params))).rows; }
  async all(...params) { const rows = await this.rows(params); return this.plucked ? rows.map(r => Object.values(r)[0]) : rows; }
  async get(...params) { const rows = await this.all(...params); return rows[0]; }
  async run(...params) {
    const result = await this.db.query(this.sql.text, this.values(params));
    const first = result.rows?.[0];
    return { changes: result.rowCount ?? result.affectedRows ?? 0, lastInsertRowid: first && 'id' in first ? first.id : undefined };
  }
}

export class Db {
  // query(text, params) → { rows, rowCount }; connect() → a client for one transaction; exec(sql) runs a multi-statement script.
  constructor({ query, connect, exec, close, serial = false }) {
    Object.assign(this, { base: { query, connect, exec, close }, serial });
    this.lock = Promise.resolve();
  }
  // A single-connection engine (PGlite) must not interleave another flow's statements into an open transaction.
  async serialised(work) {
    const previous = this.lock;
    let release;
    this.lock = new Promise(r => { release = r; });
    await previous;
    try { return await work(); } finally { release(); }
  }
  async query(text, params) {
    const tx = txStore.getStore();
    const run = () => (tx ? tx.query(text, params) : this.serial ? this.serialised(() => this.base.query(text, params)) : this.base.query(text, params));
    try { return await run(); } catch (error) {
      // Postgres errors don't say which statement failed; attach it (never the parameter values).
      error.message = `${error.message}\n  in: ${text.replace(/\s+/g, ' ').slice(0, 300)}`;
      throw error;
    }
  }
  prepare(sql) { return new Statement(this, sql); }
  async exec(sql) { const tx = txStore.getStore(); return tx?.exec ? tx.exec(sql) : this.base.exec(sql); }
  // Same shape as better-sqlite3: db.transaction(fn) returns a function; call (and await) it to run fn atomically.
  transaction(fn) {
    return async (...args) => {
      if (txStore.getStore()) return fn(...args);
      const run = async () => {
        const client = await this.base.connect();
        try {
          await client.query('BEGIN');
          const result = await txStore.run(client, () => fn(...args));
          await client.query('COMMIT');
          return result;
        } catch (error) {
          await client.query('ROLLBACK').catch(() => {});
          throw error;
        } finally { client.release?.(); }
      };
      return this.serial ? this.serialised(run) : run();
    };
  }
  close() { return this.base.close?.(); }
}
