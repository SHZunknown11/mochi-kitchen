const { resetDb, makeApp, registerUser, request } = require('./helpers');
const gemini = require('../src/services/gemini');
const { Recipe, Ingredient, GroceryItem, PantryItem, Favourite, User } = require('../src/models');
const { buildLocalPlan } = require('../src/services/mealplan');

let app;
beforeAll(async () => {
  await resetDb();
  app = makeApp();
});
afterEach(() => {
  gemini.setClient(null);
});

const idOf = async (title) => (await Recipe.findOne({ where: { title } })).id;

describe('guards', () => {
  test.each([
    ['get', '/api/favourites'], ['post', '/api/favourites'], ['post', '/api/grocery'], ['get', '/api/grocery'],
    ['get', '/api/pantry'], ['post', '/api/pantry'], ['get', '/api/pantry/match'], ['post', '/api/mealplan'], ['get', '/api/mealplan'],
  ])('%s %s needs a login', async (method, path) => {
    expect((await request(app)[method](path)).status).toBe(401);
  });
});

describe('favourites', () => {
  test('add, list, remove - and adding twice is harmless', async () => {
    const u = await registerUser(app);
    const id = await idOf('Bibimbap');

    expect((await u.auth(request(app).post('/api/favourites')).send({ recipeId: id })).status).toBe(201);
    expect((await u.auth(request(app).post('/api/favourites')).send({ recipeId: id })).status).toBe(200);
    expect(await Favourite.count({ where: { UserId: u.user.id } })).toBe(1);

    const list = await u.auth(request(app).get('/api/favourites'));
    expect(list.body.favourites).toHaveLength(1);
    expect(list.body.favourites[0]).toMatchObject({ title: 'Bibimbap', isFavourite: true });
    expect(list.body.favourites[0].ingredients.length).toBeGreaterThan(3);

    expect((await u.auth(request(app).delete(`/api/favourites/${id}`))).status).toBe(204);
    expect((await u.auth(request(app).get('/api/favourites'))).body.favourites).toEqual([]);
    expect((await u.auth(request(app).delete(`/api/favourites/${id}`))).status).toBe(204); // idempotent
  });

  test('users only see their own favourites', async () => {
    const a = await registerUser(app);
    const b = await registerUser(app);
    await a.auth(request(app).post('/api/favourites')).send({ recipeId: await idOf('Okonomiyaki') });
    expect((await b.auth(request(app).get('/api/favourites'))).body.favourites).toEqual([]);
  });

  test('validates the recipe id', async () => {
    const u = await registerUser(app);
    expect((await u.auth(request(app).post('/api/favourites')).send({ recipeId: 987654 })).status).toBe(404);
    expect((await u.auth(request(app).post('/api/favourites')).send({ recipeId: 'abc' })).status).toBe(400);
    expect((await u.auth(request(app).post('/api/favourites')).send({})).status).toBe(400);
  });
});

describe('grocery lists', () => {
  test('merges and de-duplicates ingredients from several recipes', async () => {
    const u = await registerUser(app);
    const ids = [await idOf('Bibimbap'), await idOf('Garden Vegan Bibimbap'), await idOf('Gyudon Beef Bowl')];
    const res = await u.auth(request(app).post('/api/grocery')).send({ recipeIds: ids, name: 'Date night' });
    expect(res.status).toBe(201);
    expect(res.body.list.name).toBe('Date night');
    expect(res.body.stats.shoppingItems).toBeLessThan(res.body.stats.ingredientLines);

    const items = res.body.list.items;
    const names = items.map((i) => i.name);
    expect(new Set(names).size).toBe(names.length); // no duplicates
    // rice ("cooked rice" loses its descriptor): 300 g + 300 g + 300 g = 900 g across the three recipes
    expect(items.find((i) => i.name === 'rice')).toMatchObject({ quantity: 900, unit: 'g', aisle: 'grains & noodles' });
    // sesame oil appears in both bibimbaps: 1 tbsp + 1 tbsp
    expect(items.find((i) => i.name === 'sesame oil')).toMatchObject({ quantity: 2, unit: 'tbsp' });
    // gochujang: 1 tbsp in each of the two bibimbaps
    expect(items.find((i) => i.name === 'gochujang')).toMatchObject({ quantity: 2, unit: 'tbsp' });
  });

  test('checking items off, listing and deleting', async () => {
    const u = await registerUser(app);
    const created = await u.auth(request(app).post('/api/grocery')).send({ recipeIds: [await idOf('Tteokbokki')] });
    const { id, items } = created.body.list;

    const patch = await u.auth(request(app).patch(`/api/grocery/${id}/items/${items[0].id}`)).send({ checked: true });
    expect(patch.status).toBe(200);
    expect(patch.body.item.checked).toBe(true);
    expect((await GroceryItem.findByPk(items[0].id)).checked).toBe(true);

    const lists = await u.auth(request(app).get('/api/grocery'));
    expect(lists.body.lists[0]).toMatchObject({ id, total: items.length, done: 1 });

    expect((await u.auth(request(app).get(`/api/grocery/${id}`))).body.list.items).toHaveLength(items.length);
    expect((await u.auth(request(app).delete(`/api/grocery/${id}`))).status).toBe(204);
    expect((await u.auth(request(app).get(`/api/grocery/${id}`))).status).toBe(404);
    expect(await GroceryItem.count({ where: { GroceryListId: id } })).toBe(0); // cascade
  });

  test("a user cannot read, change or delete someone else's list", async () => {
    const owner = await registerUser(app);
    const intruder = await registerUser(app);
    const created = await owner.auth(request(app).post('/api/grocery')).send({ recipeIds: [await idOf('Oyakodon')] });
    const { id, items } = created.body.list;

    expect((await intruder.auth(request(app).get(`/api/grocery/${id}`))).status).toBe(404);
    expect((await intruder.auth(request(app).patch(`/api/grocery/${id}/items/${items[0].id}`)).send({ checked: true })).status).toBe(404);
    expect((await intruder.auth(request(app).delete(`/api/grocery/${id}`))).status).toBe(404);
    expect((await owner.auth(request(app).get(`/api/grocery/${id}`))).status).toBe(200);
  });

  test('validates input', async () => {
    const u = await registerUser(app);
    const post = (body) => u.auth(request(app).post('/api/grocery')).send(body);
    expect((await post({ recipeIds: [] })).status).toBe(400);
    expect((await post({ recipeIds: [1, 1] })).status).toBe(400);
    expect((await post({ recipeIds: Array.from({ length: 22 }, (_, i) => i + 1) })).status).toBe(400);
    expect((await post({ recipeIds: ['x'] })).status).toBe(400);
    expect((await post({ recipeIds: [1, 999999] })).status).toBe(404);
    expect((await u.auth(request(app).patch('/api/grocery/1/items/1')).send({ checked: 'maybe' })).status).toBe(400);
  });
});

describe('pantry', () => {
  test('add (cleaned up), duplicates, delete and isolation', async () => {
    const u = await registerUser(app);
    const a = await u.auth(request(app).post('/api/pantry')).send({ name: '  Finely CHOPPED Tofu ' });
    expect(a.status).toBe(201);
    expect(a.body.item.name).toBe('tofu');
    expect((await u.auth(request(app).post('/api/pantry')).send({ name: 'tofu' })).status).toBe(200);
    expect(await PantryItem.count({ where: { UserId: u.user.id } })).toBe(1);

    const other = await registerUser(app);
    expect((await other.auth(request(app).get('/api/pantry'))).body.items).toEqual([]);
    expect((await other.auth(request(app).delete(`/api/pantry/${a.body.item.id}`))).status).toBe(204);
    expect(await PantryItem.count({ where: { UserId: u.user.id } })).toBe(1); // untouched

    expect((await u.auth(request(app).delete(`/api/pantry/${a.body.item.id}`))).status).toBe(204);
    expect((await u.auth(request(app).get('/api/pantry'))).body.items).toEqual([]);
  });

  test('rejects empty or nonsense names', async () => {
    const u = await registerUser(app);
    expect((await u.auth(request(app).post('/api/pantry')).send({ name: '' })).status).toBe(400);
    expect((await u.auth(request(app).post('/api/pantry')).send({ name: '(optional)' })).status).toBe(400);
  });

  test('"what can I cook?" ranks by coverage and lists what is missing', async () => {
    const u = await registerUser(app);
    expect((await u.auth(request(app).get('/api/pantry/match'))).body.recipes).toEqual([]);

    for (const name of ['kimchi', 'cooked rice', 'egg', 'spring onion', 'sesame oil', 'gochujang']) {
      await u.auth(request(app).post('/api/pantry')).send({ name });
    }
    const res = await u.auth(request(app).get('/api/pantry/match'));
    const top = res.body.recipes[0];
    expect(top.title).toBe('Kimchi Fried Rice');
    expect(top.coverage).toBe(1);
    expect(top.missing).toEqual([]);
    expect(res.body.recipes.map((r) => r.coverage)).toEqual([...res.body.recipes.map((r) => r.coverage)].sort((a, b) => b - a));
    const other = res.body.recipes.find((r) => r.missing.length > 0);
    // staples such as salt and water are not counted either way
    expect(other.have.length + other.missing.length).toBeLessThanOrEqual(other.ingredients.length);
  });

  test('"chicken" in the pantry covers "chicken thigh", and the diet profile is respected', async () => {
    const u = await registerUser(app);
    for (const name of ['chicken', 'onion', 'egg']) await u.auth(request(app).post('/api/pantry')).send({ name });
    const meaty = await u.auth(request(app).get('/api/pantry/match'));
    expect(meaty.body.recipes.some((r) => r.title === 'Oyakodon')).toBe(true);

    await u.auth(request(app).patch('/api/auth/me')).send({ dietPrefs: { diet: 'vegetarian', glutenFree: false, maxCalories: null } });
    const veg = await u.auth(request(app).get('/api/pantry/match'));
    expect(veg.body.recipes.some((r) => r.title === 'Oyakodon')).toBe(false);
    expect(veg.body.recipes.every((r) => r.diet.vegetarian)).toBe(true);
  });
});

describe('meal planner', () => {
  test('free planner builds the requested number of days from real recipes', async () => {
    const u = await registerUser(app);
    const res = await u.auth(request(app).post('/api/mealplan')).send({ days: 5 });
    expect(res.status).toBe(201);
    expect(res.body.generatedBy).toBe('local');
    expect(res.body.plan).toHaveLength(5);
    for (const d of res.body.plan) {
      expect(d.lunch.title).toEqual(expect.any(String));
      expect(d.dinner.title).toEqual(expect.any(String));
      expect(['Dessert', 'Breakfast']).not.toContain(d.lunch.category);
    }
    expect((await u.auth(request(app).get('/api/mealplan'))).body.plan.id).toBe(res.body.id);
  });

  test('respects the dietary profile', async () => {
    const u = await registerUser(app);
    await u.auth(request(app).patch('/api/auth/me')).send({ dietPrefs: { diet: 'vegan', glutenFree: true, maxCalories: 600 } });
    const res = await u.auth(request(app).post('/api/mealplan')).send({ days: 7 });
    expect(res.status).toBe(201);
    for (const d of res.body.plan) {
      for (const meal of [d.lunch, d.dinner]) {
        expect(meal.diet).toMatchObject({ vegan: true, glutenFree: true });
        expect(meal.calories).toBeLessThanOrEqual(600);
      }
    }
  });

  test('explains itself when nothing matches', async () => {
    const u = await registerUser(app);
    // 40 kcal is below the API's allowed minimum, so set it directly to build an impossible profile.
    await User.update({ dietPrefs: { diet: 'vegan', glutenFree: true, maxCalories: 40 } }, { where: { id: u.user.id } });
    const res = await u.auth(request(app).post('/api/mealplan')).send({ days: 3 });
    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/dietary/);
  });

  test('uses Gemini when it is available and the answer only contains known recipes', async () => {
    const u = await registerUser(app);
    const a = await idOf('Gyudon Beef Bowl');
    const b = await idOf('Kitsune Udon');
    gemini.setClient({ models: { generateContent: async () => ({ text: JSON.stringify([
      { day: 1, lunch: a, dinner: b, note: 'Warm <i>and</i> easy.' }, { day: 2, lunch: b, dinner: a, note: 'Enjoy!' }, { day: 3, lunch: a, dinner: a, note: '' },
    ]) }) } });
    const res = await u.auth(request(app).post('/api/mealplan')).send({ days: 3, provider: 'ai' });
    expect(res.body.generatedBy).toBe('ai');
    expect(res.body.plan[0]).toMatchObject({ note: 'Warm and easy.' });
    expect(res.body.plan[0].lunch.id).toBe(a);
  });

  test('falls back to the free planner when Gemini invents a recipe id', async () => {
    const u = await registerUser(app);
    gemini.setClient({ models: { generateContent: async () => ({ text: JSON.stringify([{ day: 1, lunch: 424242, dinner: 1, note: 'x' }]) }) } });
    const res = await u.auth(request(app).post('/api/mealplan')).send({ days: 3, provider: 'ai' });
    expect(res.status).toBe(201);
    expect(res.body.generatedBy).toBe('local');
  });

  test('validates the number of days and provider', async () => {
    const u = await registerUser(app);
    expect((await u.auth(request(app).post('/api/mealplan')).send({ days: 2 })).status).toBe(400);
    expect((await u.auth(request(app).post('/api/mealplan')).send({ days: 8 })).status).toBe(400);
    expect((await u.auth(request(app).post('/api/mealplan')).send({ provider: 'x' })).status).toBe(400);
  });

  test('a plan can be turned straight into a shopping list', async () => {
    const u = await registerUser(app);
    const plan = (await u.auth(request(app).post('/api/mealplan')).send({ days: 3 })).body;
    const recipeIds = [...new Set(plan.plan.flatMap((d) => [d.lunch.id, d.dinner.id]))];
    const res = await u.auth(request(app).post('/api/grocery')).send({ recipeIds, name: 'This week' });
    expect(res.status).toBe(201);
    expect(res.body.list.items.length).toBeGreaterThan(5);
  });
});

describe('buildLocalPlan (unit)', () => {
  const pool = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, calories: (i + 1) * 100 }));

  test('is deterministic for a seed and varies between seeds', () => {
    expect(buildLocalPlan(pool, 7, 5)).toEqual(buildLocalPlan(pool, 7, 5));
    expect(buildLocalPlan(pool, 7, 5)).not.toEqual(buildLocalPlan(pool, 7, 6));
  });

  test('lunches come from the lighter half, dinners from the heavier half, no repeats while the pool lasts', () => {
    const plan = buildLocalPlan(pool, 5, 3);
    plan.forEach((d) => {
      expect(d.lunch).toBeLessThanOrEqual(5);
      expect(d.dinner).toBeGreaterThan(5);
    });
    expect(new Set(plan.map((d) => d.lunch)).size).toBe(5);
    expect(new Set(plan.map((d) => d.dinner)).size).toBe(5);
  });

  test('repeats gracefully when the pool is small, and copes with a single recipe', () => {
    const plan = buildLocalPlan(pool.slice(0, 2), 4, 1);
    expect(plan).toHaveLength(4);
    expect(buildLocalPlan([{ id: 9, calories: 300 }], 3, 1).every((d) => d.lunch === 9 && d.dinner === 9)).toBe(true);
  });
});

describe('data integrity', () => {
  test('deleting a recipe removes its ingredients and favourites', async () => {
    const u = await registerUser(app);
    const id = await idOf('Egg Sando');
    await u.auth(request(app).post('/api/favourites')).send({ recipeId: id });
    expect(await Ingredient.count({ where: { RecipeId: id } })).toBeGreaterThan(0);
    await Recipe.destroy({ where: { id }, individualHooks: true });
    expect(await Ingredient.count({ where: { RecipeId: id } })).toBe(0);
    expect(await Favourite.count({ where: { RecipeId: id } })).toBe(0);
  });
});
