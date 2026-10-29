const request = require('supertest');
const { sequelize } = require('../src/models');
const { createApp } = require('../src/app');
const { seedAll } = require('../src/db/seed');

let counter = 0;

/** Fresh in-memory database with the starter recipes loaded. */
async function resetDb({ seed = true } = {}) {
  await sequelize.sync({ force: true });
  if (seed) await seedAll();
}

function makeApp() {
  return createApp();
}

/** Register a new user through the real API and return a ready-to-use agent. */
async function registerUser(app, overrides = {}) {
  counter += 1;
  const body = {
    username: `user${counter}`,
    email: `user${counter}@example.com`,
    password: 'Passw0rdOk',
    ...overrides,
  };
  const res = await request(app).post('/api/auth/register').send(body);
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  const auth = (req) => req.set('Authorization', `Bearer ${res.body.accessToken}`);
  return { ...res.body, body, auth };
}

/** Replace global fetch with a router: [{ match: /regex/, body, status }]. Returns the jest mock. */
function mockFetch(routes) {
  return jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
    const hit = routes.find((r) => r.match.test(String(url)));
    if (!hit) return { ok: false, status: 404, json: async () => ({}) };
    if (hit.reject) throw new Error('network down');
    return { ok: (hit.status || 200) < 400, status: hit.status || 200, json: async () => hit.body };
  });
}

module.exports = { resetDb, makeApp, registerUser, mockFetch, request };
