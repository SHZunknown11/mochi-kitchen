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

  return new Sequelize({
    dialect: 'sqlite',
    storage: overrides.storage || db.storage,
    logging: false,
  });
}

// Tests set DB_STORAGE=:memory: through jest setup; everything else uses the file DB.
const sequelize = build({
  storage: process.env.NODE_ENV === 'test' ? ':memory:' : undefined,
});

module.exports = sequelize;
