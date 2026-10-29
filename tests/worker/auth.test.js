const { makeWorker, registerUser } = require('./helpers');
const crypt = require('../../worker/src/crypto');

let w;
beforeAll(async () => { w = await makeWorker({ seed: false }); });

describe('password hashing', () => {
  test('hashes with a per-user salt and verifies', async () => {
    const env = { PBKDF2_ITERATIONS: '1000' };
    const a = await crypt.hashPassword('Sup3rSecret', env);
    const b = await crypt.hashPassword('Sup3rSecret', env);
    expect(a).toMatch(/^pbkdf2-sha256\$1000\$/);
    expect(a).not.toBe(b);
    expect(await crypt.verifyPassword('Sup3rSecret', a)).toBe(true);
    expect(await crypt.verifyPassword('wrong', a)).toBe(false);
  });
  test('the dummy hash never matches', async () => {
    expect(await crypt.verifyPassword('anything', crypt.dummyHash({ PBKDF2_ITERATIONS: '1000' }))).toBe(false);
  });
  test('iterations are clamped to what Workers allows', () => {
    expect(crypt.iterationsFor({ PBKDF2_ITERATIONS: '999999' })).toBe(100000);
    expect(crypt.iterationsFor({})).toBe(100000);
  });
});

describe('registration', () => {
  test('creates an account and returns tokens, never the hash', async () => {
    const res = await w.call('POST', '/api/auth/register', { body: { username: 'mochi_fan', email: 'Fan@Example.com', password: 'Sup3rSecret' } });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ username: 'mochi_fan', email: 'fan@example.com' });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.refreshToken).toHaveLength(96);
    const row = await w.DB.prepare('SELECT passwordHash FROM users WHERE username = ?').bind('mochi_fan').first();
    expect(row.passwordHash).not.toContain('Sup3rSecret');
    expect(row.passwordHash).toMatch(/^pbkdf2-sha256\$/);
  });

  test.each([
    ['short password', { password: 'abc1' }],
    ['no digit', { password: 'onlyletters' }],
    ['no letter', { password: '12345678' }],
    ['bad email', { email: 'not-an-email' }],
    ['bad username', { username: 'no spaces!' }],
    ['tiny username', { username: 'ab' }],
  ])('rejects %s', async (_l, override) => {
    const res = await w.call('POST', '/api/auth/register', { body: { username: 'valid_name', email: 'valid@example.com', password: 'Passw0rdOk', ...override } });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toEqual(expect.any(String));
  });

  test('duplicate email or username gives 409', async () => {
    await w.call('POST', '/api/auth/register', { body: { username: 'dupe_one', email: 'dupe@example.com', password: 'Passw0rdOk' } });
    const email = await w.call('POST', '/api/auth/register', { body: { username: 'other_name', email: 'DUPE@example.com', password: 'Passw0rdOk' } });
    const name = await w.call('POST', '/api/auth/register', { body: { username: 'dupe_one', email: 'new@example.com', password: 'Passw0rdOk' } });
    expect([email.status, name.status]).toEqual([409, 409]);
    expect(email.body.error.message).toMatch(/email/);
    expect(name.body.error.message).toMatch(/username/);
  });

  test('bad JSON gives 400 and oversize gives 413', async () => {
    expect((await w.call('POST', '/api/auth/login', { body: '{nope' })).status).toBe(400);
    expect((await w.call('POST', '/api/auth/login', { body: { identifier: 'x'.repeat(60000), password: 'a' } })).status).toBe(413);
  });
});

describe('login and sessions', () => {
  let user;
  beforeAll(async () => { user = await registerUser(w, { username: 'login_user', email: 'login@example.com' }); });

  test('logs in by email (any case) or username', async () => {
    expect((await w.call('POST', '/api/auth/login', { body: { identifier: 'LOGIN@example.com', password: 'Passw0rdOk' } })).status).toBe(200);
    expect((await w.call('POST', '/api/auth/login', { body: { identifier: 'login_user', password: 'Passw0rdOk' } })).status).toBe(200);
  });
  test('same error for wrong password and unknown account', async () => {
    const bad = await w.call('POST', '/api/auth/login', { body: { identifier: 'login_user', password: 'Nope12345' } });
    const none = await w.call('POST', '/api/auth/login', { body: { identifier: 'ghost_user', password: 'Nope12345' } });
    expect(bad.status).toBe(401);
    expect(none.status).toBe(401);
    expect(bad.body).toEqual(none.body);
  });
  test('/me needs a valid token', async () => {
    expect((await w.call('GET', '/api/auth/me')).status).toBe(401);
    expect((await w.call('GET', '/api/auth/me', { token: 'garbage' })).status).toBe(401);
    const ok = await w.call('GET', '/api/auth/me', { token: user.accessToken });
    expect(ok.body.user.username).toBe('login_user');
  });
  test('a token signed with another secret is rejected', async () => {
    const forged = await crypt.signAccessToken({ id: user.user.id, username: 'login_user' }, { JWT_ACCESS_SECRET: 'x'.repeat(40) });
    expect((await w.call('GET', '/api/auth/me', { token: forged })).status).toBe(401);
  });
  test('profile diet prefs are saved and validated', async () => {
    const res = await w.call('PATCH', '/api/auth/me', { token: user.accessToken, body: { dietPrefs: { diet: 'vegan', glutenFree: true, maxCalories: 500 } } });
    expect(res.body.user.dietPrefs).toEqual({ diet: 'vegan', glutenFree: true, maxCalories: 500 });
    expect((await w.call('GET', '/api/auth/me', { token: user.accessToken })).body.user.dietPrefs.diet).toBe('vegan');
    expect((await w.call('PATCH', '/api/auth/me', { token: user.accessToken, body: { dietPrefs: { diet: 'carnivore' } } })).status).toBe(400);
  });
});

describe('refresh tokens', () => {
  test('rotate, store only a hash, and detect replay', async () => {
    const u = await registerUser(w);
    const stored = await w.DB.prepare('SELECT tokenHash FROM refresh_tokens WHERE UserId = ?').bind(u.user.id).first();
    expect(stored.tokenHash).not.toBe(u.refreshToken);
    expect(stored.tokenHash).toHaveLength(64);

    const next = await w.call('POST', '/api/auth/refresh', { body: { refreshToken: u.refreshToken } });
    expect(next.status).toBe(200);
    expect(next.body.refreshToken).not.toBe(u.refreshToken);

    const replay = await w.call('POST', '/api/auth/refresh', { body: { refreshToken: u.refreshToken } });
    expect(replay.status).toBe(401);
    // Replaying a used token kills the whole family, including the newest token.
    expect((await w.call('POST', '/api/auth/refresh', { body: { refreshToken: next.body.refreshToken } })).status).toBe(401);
  });
  test('logout revokes the token', async () => {
    const u = await registerUser(w);
    expect((await w.call('POST', '/api/auth/logout', { body: { refreshToken: u.refreshToken } })).status).toBe(204);
    expect((await w.call('POST', '/api/auth/refresh', { body: { refreshToken: u.refreshToken } })).status).toBe(401);
  });
  test('expired and malformed tokens are refused', async () => {
    const u = await registerUser(w);
    await w.DB.prepare('UPDATE refresh_tokens SET expiresAt = ? WHERE UserId = ?').bind('2000-01-01T00:00:00.000Z', u.user.id).run();
    expect((await w.call('POST', '/api/auth/refresh', { body: { refreshToken: u.refreshToken } })).status).toBe(401);
    expect((await w.call('POST', '/api/auth/refresh', { body: { refreshToken: 'abc' } })).status).toBe(400);
  });
});

describe('rate limiting', () => {
  test('auth attempts are limited per IP (D1 counter)', async () => {
    const lw = await makeWorker({ seed: false, env: { DISABLE_RATE_LIMIT: '0' } });
    const codes = [];
    for (let i = 0; i < 22; i += 1) {
      codes.push((await lw.call('POST', '/api/auth/login', { body: { identifier: 'nobody1', password: 'x' }, headers: { 'cf-connecting-ip': '9.9.9.9' } })).status);
    }
    expect(codes.slice(0, 20).every((c) => c === 401)).toBe(true);
    expect(codes.slice(20)).toEqual([429, 429]);
    // A different IP is unaffected.
    expect((await lw.call('POST', '/api/auth/login', { body: { identifier: 'nobody1', password: 'x' }, headers: { 'cf-connecting-ip': '8.8.8.8' } })).status).toBe(401);
  });
  test('the Cloudflare binding blocks when it says no', async () => {
    const lw = await makeWorker({ seed: false, env: { DISABLE_RATE_LIMIT: '0', API_LIMITER: { limit: async () => ({ success: false }) } } });
    expect((await lw.call('GET', '/api/ai/status')).status).toBe(429);
    expect((await lw.call('GET', '/api/health')).status).toBe(200);
  });
});
