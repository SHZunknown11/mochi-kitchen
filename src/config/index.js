const path = require('path');
const crypto = require('crypto');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });

const root = path.join(__dirname, '..', '..');

// Secrets: use the configured ones, otherwise generate per-process random ones.
// (Random secrets mean tokens stop working after a restart, which is fine for a demo.)
const randomSecret = () => crypto.randomBytes(48).toString('hex');

const config = {
  root,
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  db: {
    dialect: process.env.DB_DIALECT || 'sqlite',
    storage: path.resolve(root, process.env.DB_STORAGE || 'data/mochi.sqlite'),
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    name: process.env.DB_NAME || 'mochi_kitchen',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || randomSecret(),
    refreshSecret: process.env.JWT_REFRESH_SECRET || randomSecret(),
    accessTtl: '15m',
    refreshTtlDays: 7,
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-flash-lite-latest',
    timeoutMs: 25000,
  },
  spoonacularKey: process.env.SPOONACULAR_API_KEY || '',
  cacheTtlMs: 24 * 60 * 60 * 1000,
};

module.exports = config;
