const config = require('./config');
const sequelize = require('./db/sequelize');
const { migrateUp } = require('./db/migrate');
const { seedAll } = require('./db/seed');
const { createApp } = require('./app');
const { clearExpired } = require('./services/cache');

async function main() {
  await sequelize.authenticate();
  // First run (or a fresh clone): create the tables and starter recipes automatically.
  await migrateUp();
  const { created } = await seedAll();
  if (created > 0) console.log(`Seeded ${created} starter recipes.`);
  await clearExpired();

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`Mochi Kitchen is open at http://localhost:${config.port}`);
    if (!config.gemini.apiKey) {
      console.log('No GEMINI_API_KEY found - running in free mode. Add your own key to .env to switch on the AI.');
    }
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${config.port} is already in use. Set a different PORT in your .env file and try again.`);
    } else {
      console.error('Server error:', err.message);
    }
    process.exit(1);
  });
}

main().catch((err) => {
  console.error('Could not start the server:', err.message);
  process.exit(1);
});
