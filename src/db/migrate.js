const path = require('path');
const { Umzug, SequelizeStorage } = require('umzug');
const sequelize = require('./sequelize');

function createMigrator() {
  return new Umzug({
    migrations: {
      glob: ['migrations/*.js', { cwd: path.join(__dirname, '..') }],
    },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize }),
    logger: undefined,
  });
}

async function migrateUp() {
  return createMigrator().up();
}

async function migrateDown() {
  return createMigrator().down();
}

module.exports = { createMigrator, migrateUp, migrateDown };

if (require.main === module) {
  const direction = process.argv[2] === 'down' ? migrateDown : migrateUp;
  direction()
    .then((done) => {
      console.log(`${process.argv[2] === 'down' ? 'Reverted' : 'Applied'} ${done.length} migration(s).`);
      return sequelize.close();
    })
    .catch((err) => {
      console.error('Migration failed:', err.message);
      process.exit(1);
    });
}
