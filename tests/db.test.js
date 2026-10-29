const { QueryTypes } = require('sequelize');
const { sequelize, User, Recipe, Ingredient, ApiCache } = require('../src/models');
const { createMigrator } = require('../src/db/migrate');
const { cached } = require('../src/services/cache');
const { saveRecipe, toSteps } = require('../src/services/recipeStore');

const TABLES = ['api_cache', 'favourites', 'grocery_items', 'grocery_lists', 'ingredients', 'meal_plans',
  'pantry_items', 'recipes', 'refresh_tokens', 'users'];

const tableNames = async () => (await sequelize.getQueryInterface().showAllTables())
  .map((t) => (typeof t === 'string' ? t : t.tableName)).filter((t) => !/^(sqlite_|SequelizeMeta)/.test(t));

describe('SQLite connection settings', () => {
  test('busy timeout and foreign keys are switched on for every connection', async () => {
    const pragma = async (name) => Object.values((await sequelize.query(`PRAGMA ${name}`, { type: QueryTypes.SELECT }))[0])[0];
    expect(await pragma('busy_timeout')).toBe(5000);
    expect(['wal', 'memory']).toContain(await pragma('journal_mode')); // in-memory databases cannot use WAL
    expect(await pragma('foreign_keys')).toBe(1);
  });
});

describe('migrations', () => {
  test('up creates every table, and down removes them again', async () => {
    const migrator = createMigrator();
    expect((await migrator.up()).map((m) => m.name)).toEqual(['001-init.js']);
    expect((await tableNames()).sort()).toEqual([...TABLES].sort());

    expect(await migrator.pending()).toEqual([]); // running twice does nothing
    await migrator.down();
    expect(await tableNames()).toEqual([]);
  });

  test('the migrated schema accepts the same data as the models', async () => {
    await createMigrator().up();
    const user = await User.create({ username: 'migrated', email: 'm@example.com', passwordHash: 'x' });
    expect(user.dietPrefs).toEqual({ diet: 'none', glutenFree: false, maxCalories: null });
    await expect(User.create({ username: 'migrated', email: 'other@example.com', passwordHash: 'x' })).rejects.toThrow();
    await createMigrator().down();
  });
});

describe('recipe store', () => {
  beforeAll(async () => { await sequelize.sync({ force: true }); });

  const dto = (over = {}) => ({
    source: 'seed', externalId: 'dup-test', title: 'Dup Test', instructions: 'STEP 1\nMix.\nSTEP 2\nServe.',
    servings: 2, ingredients: [{ name: 'tofu', measure: '200 g' }, { name: 'rice', measure: '1 cup' }], ...over,
  });

  test('saving the same recipe twice keeps one copy and does not duplicate ingredients', async () => {
    const a = await saveRecipe(dto());
    const b = await saveRecipe(dto({ title: 'Changed title' }));
    expect(b.id).toBe(a.id);
    expect(b.title).toBe('Dup Test');
    expect(await Ingredient.count({ where: { RecipeId: a.id } })).toBe(2);
  });

  test('simultaneous saves of one recipe end up with one row', async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => saveRecipe(dto({ externalId: 'race', title: 'Race' }))));
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    expect(await Recipe.count({ where: { externalId: 'race' } })).toBe(1);
  });

  test('parses quantities and works out diet flags and calories itself', async () => {
    const r = await saveRecipe(dto({ externalId: 'calc', ingredients: [{ name: 'rice', measure: '400 g' }, { name: 'egg', measure: '2' }] }));
    expect(r.Ingredients.map((i) => [i.name, i.quantity, i.unit])).toEqual([['rice', 400, 'g'], ['egg', 2, null]]);
    expect(r).toMatchObject({ isVegetarian: true, isVegan: false, isGlutenFree: true, caloriesSource: 'estimate' });
    expect(r.calories).toBeGreaterThan(100);
  });

  test('an AI-supplied calorie figure is kept and labelled; an absurd estimate is dropped', async () => {
    const ai = await saveRecipe(dto({ externalId: 'ai-kcal', calories: 512 }));
    expect(ai).toMatchObject({ calories: 512, caloriesSource: 'ai' });
    const huge = await saveRecipe(dto({ externalId: 'huge', servings: 1, ingredients: [{ name: 'butter', measure: '2 kg' }] }));
    expect(huge.calories).toBeNull();
  });

  test('toSteps strips STEP headings and numbering', () => {
    expect(toSteps('STEP 1\nMix well.\r\n\r\nStep 2: Bake.\n3. Serve\n')).toEqual(['Mix well.', 'Bake.', 'Serve']);
    expect(toSteps(null)).toEqual([]);
  });
});

describe('api cache', () => {
  beforeAll(async () => { await sequelize.sync({ force: true }); });

  test('calls the loader once, then serves from the cache until it expires', async () => {
    const loader = jest.fn(async () => ({ hello: 'world' }));
    expect(await cached('k1', loader)).toEqual({ hello: 'world' });
    expect(await cached('k1', loader)).toEqual({ hello: 'world' });
    expect(loader).toHaveBeenCalledTimes(1);

    await ApiCache.update({ expiresAt: new Date(Date.now() - 1000) }, { where: { key: 'k1' } });
    await cached('k1', loader);
    expect(loader).toHaveBeenCalledTimes(2);
    expect(await ApiCache.count({ where: { key: 'k1' } })).toBe(1); // refreshed, not duplicated
  });

  test('a corrupt cache row is refreshed instead of crashing', async () => {
    await ApiCache.create({ key: 'bad', payload: '{not json', expiresAt: new Date(Date.now() + 100000) });
    expect(await cached('bad', async () => [1, 2])).toEqual([1, 2]);
  });

  test('loader errors are not cached', async () => {
    await expect(cached('boom', async () => { throw new Error('upstream'); })).rejects.toThrow('upstream');
    expect(await ApiCache.count({ where: { key: 'boom' } })).toBe(0);
  });
});
