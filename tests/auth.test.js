const { resetDb, makeApp, registerUser, request } = require('./helpers');
const { RefreshToken, User } = require('../src/models');

let app;
beforeAll(async () => {
  await resetDb({ seed: false });
  app = makeApp();
});

describe('registration', () => {
  test('creates an account, hashes the password and returns tokens', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ username: 'mochi_fan', email: 'Fan@Example.com', password: 'Sup3rSecret' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ username: 'mochi_fan', email: 'fan@example.com' });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toHaveLength(96);

    const row = await User.findOne({ where: { username: 'mochi_fan' } });
    expect(row.passwordHash).not.toContain('Sup3rSecret');
    expect(row.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  test.each([
    ['short password', { password: 'abc1' }],
    ['no digit in password', { password: 'onlyletters' }],
    ['no letter in password', { password: '12345678' }],
    ['bad email', { email: 'not-an-email' }],
    ['bad username', { username: 'no spaces!' }],
    ['tiny username', { username: 'ab' }],
  ])('rejects %s', async (_label, override) => {
    const res = await request(app).post('/api/auth/register')
      .send({ username: 'valid_name', email: 'valid@example.com', password: 'Passw0rdOk', ...override });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toEqual(expect.any(String));
  });

  test('rejects a duplicate email or username with 409', async () => {
    await request(app).post('/api/auth/register').send({ username: 'dupe_one', email: 'dupe@example.com', password: 'Passw0rdOk' });
    const sameEmail = await request(app).post('/api/auth/register')
      .send({ username: 'dupe_two', email: 'DUPE@example.com', password: 'Passw0rdOk' });
    expect(sameEmail.status).toBe(409);
    expect(sameEmail.body.error.message).toMatch(/email/);
    const sameName = await request(app).post('/api/auth/register')
      .send({ username: 'dupe_one', email: 'other@example.com', password: 'Passw0rdOk' });
    expect(sameName.status).toBe(409);
    expect(sameName.body.error.message).toMatch(/username/);
  });

  test('ignores unknown fields instead of trusting them', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ username: 'extra_field', email: 'extra@example.com', password: 'Passw0rdOk', id: 999, dietPrefs: 'x' });
    expect(res.status).toBe(201);
    expect(res.body.user.id).not.toBe(999);
  });
});

describe('login', () => {
  beforeAll(async () => {
    await request(app).post('/api/auth/register').send({ username: 'login_user', email: 'login@example.com', password: 'Passw0rdOk' });
  });

  test('works with email or username', async () => {
    for (const identifier of ['login@example.com', 'LOGIN@example.com', 'login_user']) {
      const res = await request(app).post('/api/auth/login').send({ identifier, password: 'Passw0rdOk' });
      expect(res.status).toBe(200);
      expect(res.body.user.username).toBe('login_user');
    }
  });

  test('wrong password and unknown user give the same message', async () => {
    const wrong = await request(app).post('/api/auth/login').send({ identifier: 'login_user', password: 'nope-nope1' });
    const unknown = await request(app).post('/api/auth/login').send({ identifier: 'ghost_user', password: 'nope-nope1' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  test('requires both fields', async () => {
    const res = await request(app).post('/api/auth/login').send({ identifier: 'login_user' });
    expect(res.status).toBe(400);
  });
});

describe('route guard', () => {
  test('rejects missing, malformed and forged tokens', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Authorization', 'Bearer nonsense')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Authorization', 'Basic abc')).status).toBe(401);

    const jwt = require('jsonwebtoken');
    const forged = jwt.sign({ sub: 1 }, 'wrong-secret');
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${forged}`)).status).toBe(401);
  });

  test('rejects a token for a deleted user', async () => {
    const u = await registerUser(app);
    await User.destroy({ where: { id: u.user.id } });
    expect((await u.auth(request(app).get('/api/auth/me'))).status).toBe(401);
  });

  test('returns the profile for a valid token', async () => {
    const u = await registerUser(app);
    const res = await u.auth(request(app).get('/api/auth/me'));
    expect(res.status).toBe(200);
    expect(res.body.user.dietPrefs).toEqual({ diet: 'none', glutenFree: false, maxCalories: null });
  });
});

describe('refresh tokens', () => {
  test('rotate: the old token stops working, the new one works', async () => {
    const u = await registerUser(app);
    const first = await request(app).post('/api/auth/refresh').send({ refreshToken: u.refreshToken });
    expect(first.status).toBe(200);
    expect(first.body.refreshToken).not.toBe(u.refreshToken);

    const reuse = await request(app).post('/api/auth/refresh').send({ refreshToken: u.refreshToken });
    expect(reuse.status).toBe(401);
  });

  test('reusing a spent token revokes every session of that user', async () => {
    const u = await registerUser(app);
    const first = await request(app).post('/api/auth/refresh').send({ refreshToken: u.refreshToken });
    await request(app).post('/api/auth/refresh').send({ refreshToken: u.refreshToken }); // replay attack
    const afterReplay = await request(app).post('/api/auth/refresh').send({ refreshToken: first.body.refreshToken });
    expect(afterReplay.status).toBe(401);
  });

  test('expired tokens are refused', async () => {
    const u = await registerUser(app);
    await RefreshToken.update({ expiresAt: new Date(Date.now() - 1000) }, { where: { UserId: u.user.id } });
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: u.refreshToken });
    expect(res.status).toBe(401);
  });

  test('logout revokes the token; unknown tokens are rejected; format is validated', async () => {
    const u = await registerUser(app);
    expect((await request(app).post('/api/auth/logout').send({ refreshToken: u.refreshToken })).status).toBe(204);
    expect((await request(app).post('/api/auth/refresh').send({ refreshToken: u.refreshToken })).status).toBe(401);
    expect((await request(app).post('/api/auth/refresh').send({ refreshToken: 'a'.repeat(96) })).status).toBe(401);
    expect((await request(app).post('/api/auth/refresh').send({ refreshToken: 'short' })).status).toBe(400);
  });

  test('stored refresh tokens are hashed, not the raw value', async () => {
    const u = await registerUser(app);
    const rows = await RefreshToken.findAll({ where: { UserId: u.user.id } });
    expect(rows.some((r) => r.tokenHash === u.refreshToken)).toBe(false);
    expect(rows[0].tokenHash).toHaveLength(64);
  });
});

describe('profile', () => {
  test('saves dietary preferences and validates them', async () => {
    const u = await registerUser(app);
    const ok = await u.auth(request(app).patch('/api/auth/me'))
      .send({ dietPrefs: { diet: 'vegan', glutenFree: true, maxCalories: 600 } });
    expect(ok.status).toBe(200);
    expect(ok.body.user.dietPrefs).toEqual({ diet: 'vegan', glutenFree: true, maxCalories: 600 });

    const me = await u.auth(request(app).get('/api/auth/me'));
    expect(me.body.user.dietPrefs.diet).toBe('vegan');

    const bad = await u.auth(request(app).patch('/api/auth/me')).send({ dietPrefs: { diet: 'carnivore' } });
    expect(bad.status).toBe(400);
    const tooLow = await u.auth(request(app).patch('/api/auth/me')).send({ dietPrefs: { maxCalories: 5 } });
    expect(tooLow.status).toBe(400);
  });
});

describe('plumbing', () => {
  test('malformed JSON gets a clear 400 and unknown API routes a 404', async () => {
    const bad = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{oops');
    expect(bad.status).toBe(400);
    expect((await request(app).get('/api/definitely-not-here')).status).toBe(404);
  });

  test('security headers are set and the framework is not advertised', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
