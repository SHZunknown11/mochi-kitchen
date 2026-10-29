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
  });

  // WAL lets readers and one writer work together; busy_timeout makes writers queue for up to 5 s.
  // Sequelize does not run its afterConnect hook for SQLite, so we wrap getConnection ourselves.
  const manager = instance.connectionManager;
  const getConnection = manager.getConnection.bind(manager);
  const configured = new WeakSet();
  manager.getConnection = async (options) => {
    const connection = await getConnection(options);
    if (!configured.has(connection)) {
      configured.add(connection);
      connection.configure('busyTimeout', 5000);
      await new Promise((resolve, reject) => {
        connection.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;', (err) => (err ? reject(err) : resolve()));
      });
    }
    return connection;
  };
  return instance;
}

// Tests set DB_STORAGE=:memory: through jest setup; everything else uses the file DB.
const sequelize = build({
  storage: process.env.NODE_ENV === 'test' ? ':memory:' : undefined,
});

module.exports = sequelize;
