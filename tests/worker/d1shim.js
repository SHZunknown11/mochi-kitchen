// Minimal Cloudflare D1 stand-in on top of sqlite3, so Worker code runs under Jest with real SQL.
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');

const call = (db, method, sql, params) => new Promise((resolve, reject) => {
  db[method](sql, params, function cb(err, out) {
    if (err) return reject(err);
    return resolve(method === 'run' ? { lastID: this.lastID, changes: this.changes } : out);
  });
});

class Statement {
  constructor(db, sql) { this.db = db; this.sql = sql; this.params = []; }
  bind(...params) { this.params = params; return this; }
  async all() { return { results: await call(this.db, 'all', this.sql, this.params), success: true }; }
  async first() { return (await call(this.db, 'get', this.sql, this.params)) || null; }
  async run() {
    const r = await call(this.db, 'run', this.sql, this.params);
    return { success: true, meta: { last_row_id: r.lastID, changes: r.changes } };
  }
}

function createD1({ seed = false } = {}) {
  const raw = new sqlite3.Database(':memory:');
  raw.run('PRAGMA foreign_keys = ON');
  let queue = Promise.resolve(); // one batch at a time, like D1's single writer
  const d1 = {
    prepare: (sql) => new Statement(raw, sql),
    exec: (sql) => new Promise((resolve, reject) => raw.exec(sql, (e) => (e ? reject(e) : resolve()))),
    // D1 batches are atomic: roll everything back if one statement fails.
    batch(stmts) {
      const job = queue.then(async () => {
        await call(raw, 'run', 'BEGIN', []);
        try {
          const out = [];
          for (const s of stmts) out.push(await s.run());
          await call(raw, 'run', 'COMMIT', []);
          return out;
        } catch (err) {
          await call(raw, 'run', 'ROLLBACK', []);
          throw err;
        }
      });
      queue = job.catch(() => {});
      return job;
    },
  };
  const root = path.join(__dirname, '..', '..', 'worker');
  d1.ready = (async () => {
    await d1.exec(fs.readFileSync(path.join(root, 'migrations', '0001_init.sql'), 'utf8'));
    if (seed) await d1.exec(fs.readFileSync(path.join(root, 'seed.sql'), 'utf8'));
  })();
  return d1;
}

module.exports = { createD1 };
