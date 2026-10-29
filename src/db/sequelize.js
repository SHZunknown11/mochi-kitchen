const { Sequelize } = require('sequelize');
const config = require('../config');

function build(overrides = {}) {
  const { db } = config;
  const dialect = overrides.dialect || db.dialect;

  if (dialect === 'mysql') {
    // mysql2 is only required when MySQL is chosen: `npm install mysql2`
    return new Sequelize(db.name, db.user, db.password, {
      host: db.host,
      port: db.port,
      dialect: 'mysql',
      logging: false,
    });
  }

  const instance = new Sequelize({
    dialect: 'sqlite',
    storage: overrides.storage || db.storage,
    logging: false,
    // A request can write while another one is still saving recipes: wait and retry rather than failing.
    retry: { match: [/SQLITE_BUSY/], max: 3 },
    // findOrCreate reads and then writes inside one transaction. With the default (deferred) type SQLite
    // refuses the upgrade at once when another writer got in first; IMMEDIATE queues for the lock instead.
    transactionType: 'IMMEDIATE',
  });

  // WAL lets readers and one writer work together; busy_timeout makes writers queue for up to 5 s.
  // Sequelize does not run its afterConnect hook for SQLite, so we wrap getConnection ourselves.
  const manager = instance.connectionManager;
  const getConnection = manager.getConnection.bind(manager);
  const configured = new WeakSet();
  let walRequested = false;
  const run = (connection, sql) => new Promise((resolve, reject) => {
    connection.exec(sql, (err) => (err ? reject(err) : resolve()));
  });
  manager.getConnection = async (options) => {
    const connection = await getConnection(options);
    if (!configured.has(connection)) {
      configured.add(connection);
      connection.configure('busyTimeout', 5000);
      await run(connection, 'PRAGMA foreign_keys = ON;');
      // WAL is stored in the database file, so asking once is enough. Asking again from a busy
      // connection can block behind another connection's write lock.
      if (!walRequested) {
        walRequested = true;
        await run(connection, 'PRAGMA journal_mode = WAL;');
      }
    }
    return connection;
  };
  serializeTransactions(instance);
  return instance;
}

/**
 * Let only one top-level transaction run at a time in this process.
 * SQLite has a single writer, and each waiting writer blocks one of Node's few libuv worker threads
 * (4 by default). With enough waiters the thread that must run the lock holder's COMMIT is never free
 * and the process hangs. Queueing in JavaScript instead keeps the workers free.
 */
function serializeTransactions(instance) {
  const original = instance.transaction.bind(instance);
  let tail = Promise.resolve();
  const LOCK_GUARD_MS = 30000;

  instance.transaction = async (options, callback) => {
    const cb = typeof options === 'function' ? options : callback;
    const opts = typeof options === 'function' ? undefined : options;
    if (opts && opts.transaction) return original(opts, cb); // nested (savepoint): the lock is already held

    let release;
    const previous = tail;
    tail = new Promise((resolve) => { release = resolve; });
    await previous;
    const guard = setTimeout(release, LOCK_GUARD_MS); // never let a forgotten transaction block everyone
    guard.unref();
    const done = () => { clearTimeout(guard); release(); };

    try {
      if (cb) return await original(opts, cb);
      // Unmanaged form (used by findOrCreate): hold the lock until the caller commits or rolls back.
      const t = await original(opts);
      const commit = t.commit.bind(t);
      const rollback = t.rollback.bind(t);
      t.commit = async () => { try { return await commit(); } finally { done(); } };
      t.rollback = async () => { try { return await rollback(); } finally { done(); } };
      return t;
    } catch (err) {
      done();
      throw err;
    } finally {
      if (cb) done();
    }
  };
}

// Tests set DB_STORAGE=:memory: through jest setup; everything else uses the file DB.
const sequelize = build({
  storage: process.env.NODE_ENV === 'test' ? ':memory:' : undefined,
});

sequelize.build = build; // exposed so tests can open a second (file-backed) connection
module.exports = sequelize;
