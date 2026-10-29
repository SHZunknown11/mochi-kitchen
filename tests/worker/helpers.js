const { createApp } = require('../../worker/src/app');
const { createD1 } = require('./d1shim');

const SECRETS = {
  JWT_ACCESS_SECRET: 'test-access-secret-0123456789-0123456789',
  JWT_REFRESH_SECRET: 'test-refresh-secret-9876543210-9876543210',
  PBKDF2_ITERATIONS: '1000',
  DISABLE_RATE_LIMIT: '1',
};

let n = 0;

async function makeWorker({ seed = true, env = {} } = {}) {
  const DB = createD1({ seed });
  await DB.ready;
  const app = createApp();
  const full = { DB, ...SECRETS, ...env };
  const call = async (method, path, { body, token, headers } = {}) => {
    const res = await app.request(path, {
      method,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    }, full);
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
    return { status: res.status, body: json, text, headers: res.headers };
  };
  return { DB, env: full, call };
}

async function registerUser(w, overrides = {}) {
  n += 1;
  const body = { username: `user${n}`, email: `user${n}@example.com`, password: 'Passw0rdOk', ...overrides };
  const res = await w.call('POST', '/api/auth/register', { body });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${res.text}`);
  return { ...res.body, creds: body };
}

/** Replace global fetch with a router: [{ match: /regex/, body, status, reject }]. */
function mockFetch(routes) {
  return jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
    const hit = routes.find((r) => r.match.test(String(url)));
    if (!hit) return { ok: false, status: 404, json: async () => ({}) };
    if (hit.reject) throw new Error('network down');
    return { ok: (hit.status || 200) < 400, status: hit.status || 200, json: async () => hit.body };
  });
}

module.exports = { makeWorker, registerUser, mockFetch };
