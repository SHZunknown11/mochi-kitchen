const { sequelize, ApiCache } = require('../src/models');
const { fetchJson, UpstreamError } = require('../src/utils/http');
const mealdb = require('../src/services/providers/mealdb');
const cocktaildb = require('../src/services/providers/cocktaildb');
const { createLimiter } = require('../src/middleware/rateLimit');
const { mockFetch } = require('./helpers');

beforeAll(async () => { await sequelize.sync({ force: true }); });
beforeEach(() => ApiCache.destroy({ where: {} }));
afterEach(() => jest.restoreAllMocks());

describe('fetchJson', () => {
  test('returns parsed JSON', async () => {
    mockFetch([{ match: /ok/, body: { a: 1 } }]);
    expect(await fetchJson('https://x.test/ok')).toEqual({ a: 1 });
  });

  test.each([
    ['HTTP errors', [{ match: /./, status: 500, body: {} }], /responded with 500/],
    ['network errors', [{ match: /./, reject: true }], /failed/],
  ])('%s become UpstreamError', async (_n, routes, message) => {
    mockFetch(routes);
    await expect(fetchJson('https://x.test/a')).rejects.toThrow(message);
    await expect(fetchJson('https://x.test/a')).rejects.toBeInstanceOf(UpstreamError);
  });

  test('invalid JSON and timeouts are reported clearly', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad'); } });
    await expect(fetchJson('https://x.test/a')).rejects.toThrow(/invalid JSON/);
    jest.restoreAllMocks();
    jest.spyOn(global, 'fetch').mockRejectedValue(Object.assign(new Error('t'), { name: 'TimeoutError' }));
    await expect(fetchJson('https://x.test/a')).rejects.toThrow(/timed out/);
  });
});

describe('TheMealDB', () => {
  test('normalizeMeal collects up to 20 ingredients and skips blanks', () => {
    const meal = { idMeal: 1, strMeal: ' Ramen  Bowl ', strInstructions: 'a\r\nb', strTags: 'Soup, Noodles', strIngredient1: 'noodles', strMeasure1: '200g', strIngredient2: '  ', strMeasure2: '1', strIngredient20: 'salt', strMeasure20: ' pinch ' };
    expect(mealdb.normalizeMeal(meal)).toMatchObject({
      source: 'mealdb', externalId: '1', title: 'Ramen Bowl', instructions: 'a\nb', tags: ['Soup', 'Noodles'], servings: 4,
      ingredients: [{ name: 'noodles', measure: '200g' }, { name: 'salt', measure: 'pinch' }],
    });
  });

  test('filter calls use underscores for spaces and tolerate "no results"', async () => {
    const spy = mockFetch([{ match: /filter\.php\?i=sweet_potato/, body: { meals: null } }, { match: /filter\.php\?a=Korean/, body: { meals: 'None_Found' } }]);
    expect(await mealdb.filterByIngredient('sweet potato')).toEqual([]);
    expect(await mealdb.filterByArea('Korean')).toEqual([]);
    expect(spy.mock.calls[0][0]).toContain('i=sweet_potato');
  });

  test('lookup returns null for an unknown id', async () => {
    mockFetch([{ match: /lookup/, body: { meals: null } }]);
    expect(await mealdb.lookup('000')).toBeNull();
  });
});

describe('TheCocktailDB', () => {
  const routes = [
    { match: /filter\.php\?a=Non_Alcoholic/, body: { drinks: [{ idDrink: '10' }, { idDrink: '11' }, { idDrink: '12' }] } },
    { match: /lookup\.php\?i=(\d+)/, body: { drinks: [{ idDrink: '1', strDrink: 'Virgin Drink', strIngredient1: 'Ice', strMeasure1: '2' }] } },
  ];

  test('the same recipe always gets the same drink', async () => {
    const spy = mockFetch(routes);
    await cocktaildb.pairingFor(7);
    await cocktaildb.pairingFor(7);
    const lookups = spy.mock.calls.map((c) => c[0]).filter((u) => u.includes('lookup'));
    expect(new Set(lookups).size).toBe(1);
  });

  test('an empty drink list gives no pairing', async () => {
    mockFetch([{ match: /./, body: { drinks: null } }]);
    expect(await cocktaildb.pairingFor(1)).toBeNull();
  });
});

describe('rate limiter', () => {
  test('blocks after the limit with a friendly 429', async () => {
    process.env.RATE_LIMIT_IN_TEST = '1';
    try {
      const express = require('express');
      const request = require('supertest');
      const app = express();
      app.use(createLimiter({ windowMs: 60000, limit: 2, message: 'Slow down, please.' }));
      app.get('/', (req, res) => res.json({ ok: true }));
      expect((await request(app).get('/')).status).toBe(200);
      expect((await request(app).get('/')).status).toBe(200);
      const blocked = await request(app).get('/');
      expect(blocked.status).toBe(429);
      expect(blocked.body.error.message).toBe('Slow down, please.');
      expect(blocked.headers['ratelimit']).toBeDefined();
    } finally {
      delete process.env.RATE_LIMIT_IN_TEST;
    }
  });
});
