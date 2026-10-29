// Mochi Kitchen on Cloudflare Workers: Hono + D1. Same API as the Express app in src/.
const { Hono } = require('hono');
const schemas = require('../../src/routes/schemas');
const { formatRecipe } = require('../../src/services/recipeFormat');
const { runSearch } = require('../../src/services/searchCore');
const { normalizeName, aggregate, formatAmount } = require('../../src/services/grocery');
const { matchesPrefs } = require('../../src/services/diet');
const { rankPantry } = require('../../src/services/pantryMatch');
const { hash, buildLocalPlan, hydrate } = require('../../src/services/planner');
const { UpstreamError } = require('../../src/utils/http');
const data = require('./data');
const crypt = require('./crypto');
const ai = require('./ai');
const providers = require('./providers');

class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ip = (c) => c.req.header('cf-connecting-ip') || 'local';

// ---- helpers ------------------------------------------------------------------
const publicUser = (u) => ({ id: u.id, username: u.username, email: u.email, dietPrefs: u.dietPrefs });

function validate(schema, value) {
  const { value: clean, error } = schema.validate(value, { abortEarly: false, stripUnknown: true, convert: true });
  if (error) {
    const details = error.details.map((d) => ({ field: d.path.join('.'), message: d.message.replace(/"/g, "'") }));
    throw new AppError(400, details[0].message, details);
  }
  return clean;
}

async function body(c, schema) {
  const text = await c.req.text();
  if (text.length > 50 * 1024) throw new AppError(413, 'The request is too large.');
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { throw new AppError(400, 'The request body is not valid JSON.'); }
  return validate(schema, json);
}

const params = (c, schema) => validate(schema, c.req.param());

async function currentUser(c) {
  const header = c.req.header('authorization') || '';
  if (!header.startsWith('Bearer ')) return { token: false, user: null };
  const id = await crypt.verifyAccessToken(header.slice(7).trim(), c.env);
  return { token: true, user: id ? await data.userById(c.env.DB, id) : null };
}
async function requireUser(c) {
  const { token, user } = await currentUser(c);
  if (!token) throw new AppError(401, 'Please log in first.');
  if (!user) throw new AppError(401, 'Your session has expired. Please log in again.');
  return user;
}
const optionalUser = async (c) => (await currentUser(c)).user;

/** Rate limits. The Cloudflare binding is used when present; auth attempts use a D1 counter. */
async function limit(c, name, { binding, limit: max, windowMs, message }) {
  if (c.env.DISABLE_RATE_LIMIT === '1') return;
  if (binding) {
    const b = c.env[binding];
    if (b && !(await b.limit({ key: `${name}:${ip(c)}` })).success) throw new AppError(429, message);
    return;
  }
  if ((await data.hit(c.env.DB, `${name}:${ip(c)}`, windowMs)) > max) throw new AppError(429, message);
}
const authLimit = (c) => limit(c, 'auth', { limit: 20, windowMs: 15 * 60 * 1000, message: 'Too many login attempts. Please wait a few minutes and try again.' });
const aiLimit = (c) => limit(c, 'ai', { binding: 'AI_LIMITER', message: 'Mochi needs a short break. Please try the AI again in a minute.' });

async function issueTokens(c, user) {
  const refreshToken = crypt.newRefreshToken();
  await data.addRefreshToken(c.env.DB, user.id, await crypt.hashRefreshToken(refreshToken, c.env),
    new Date(Date.now() + REFRESH_TTL_MS).toISOString());
  return { accessToken: await crypt.signAccessToken(user, c.env), refreshToken };
}

// ---- app ----------------------------------------------------------------------
function createApp() {
  const app = new Hono();

  app.use('/api/*', async (c, next) => {
    await next();
    c.header('Cache-Control', 'no-store');
    c.header('X-Content-Type-Options', 'nosniff');
  });
  app.use('/api/*', async (c, next) => {
    if (c.req.path !== '/api/health') await limit(c, 'api', { binding: 'API_LIMITER', message: 'Too many requests. Please slow down for a moment.' });
    await next();
  });

  app.get('/api/health', (c) => c.json({ ok: true }));

  // ---- auth ----
  app.post('/api/auth/register', async (c) => {
    await authLimit(c);
    const { username, email, password } = await body(c, schemas.register);
    const lower = email.toLowerCase();
    const clash = await data.userClash(c.env.DB, lower, username);
    if (clash) throw new AppError(409, `That ${clash.email === lower ? 'email' : 'username'} is already taken.`);
    const passwordHash = await crypt.hashPassword(password, c.env);
    let user;
    try {
      user = await data.createUser(c.env.DB, { username, email: lower, passwordHash });
    } catch (err) {
      if (/UNIQUE/i.test(String(err.message))) throw new AppError(409, 'That email or username is already taken.');
      throw err;
    }
    return c.json({ user: publicUser(user), ...(await issueTokens(c, user)) }, 201);
  });

  app.post('/api/auth/login', async (c) => {
    await authLimit(c);
    const { identifier, password } = await body(c, schemas.login);
    const user = await data.userByIdentifier(c.env.DB, identifier.trim());
    const ok = await crypt.verifyPassword(password, user ? user.passwordHash : crypt.dummyHash(c.env));
    if (!user || !ok) throw new AppError(401, 'Email/username or password is not right.');
    return c.json({ user: publicUser(user), ...(await issueTokens(c, user)) });
  });

  // Swap a refresh token for a new pair. Presenting an already-used token revokes every session.
  app.post('/api/auth/refresh', async (c) => {
    await authLimit(c);
    const { refreshToken } = await body(c, schemas.refresh);
    const row = await data.refreshByHash(c.env.DB, await crypt.hashRefreshToken(refreshToken, c.env));
    if (!row) throw new AppError(401, 'Please log in again.');
    if (row.revoked) {
      await data.revokeAllTokens(c.env.DB, row.UserId);
      throw new AppError(401, 'Please log in again.');
    }
    if (row.expiresAt < data.iso()) throw new AppError(401, 'Your session has expired. Please log in again.');
    const user = await data.userById(c.env.DB, row.UserId);
    if (!user) throw new AppError(401, 'Please log in again.');
    await data.revokeToken(c.env.DB, row.tokenHash);
    return c.json({ user: publicUser(user), ...(await issueTokens(c, user)) });
  });

  app.post('/api/auth/logout', async (c) => {
    const { refreshToken } = await body(c, schemas.refresh);
    await data.revokeToken(c.env.DB, await crypt.hashRefreshToken(refreshToken, c.env));
    return c.body(null, 204);
  });

  app.get('/api/auth/me', async (c) => c.json({ user: publicUser(await requireUser(c)) }));

  app.patch('/api/auth/me', async (c) => {
    const user = await requireUser(c);
    const { dietPrefs } = await body(c, schemas.profile);
    await data.setDietPrefs(c.env.DB, user.id, dietPrefs);
    return c.json({ user: publicUser({ ...user, dietPrefs }) });
  });

  // ---- favourites ----
  app.get('/api/favourites', async (c) => {
    const user = await requireUser(c);
    const recipes = await data.favouriteRecipes(c.env.DB, user.id);
    return c.json({ favourites: recipes.map((r) => ({ ...formatRecipe(r), isFavourite: true })) });
  });

  app.post('/api/favourites', async (c) => {
    const user = await requireUser(c);
    const { recipeId } = await body(c, schemas.favouriteAdd);
    if (!(await data.recipeExists(c.env.DB, recipeId))) throw new AppError(404, 'We could not find that recipe.');
    const created = await data.addFavourite(c.env.DB, user.id, recipeId);
    return c.json({ recipeId, isFavourite: true }, created ? 201 : 200);
  });

  app.delete('/api/favourites/:recipeId', async (c) => {
    const user = await requireUser(c);
    await data.removeFavourite(c.env.DB, user.id, params(c, schemas.recipeIdParam).recipeId);
    return c.body(null, 204);
  });

  // ---- grocery ----
  const itemJson = (i) => ({
    id: i.id, name: i.name, quantity: i.quantity, unit: i.unit, amount: formatAmount(i.quantity, i.unit), aisle: i.aisle, checked: i.checked,
  });
  const listJson = (l) => ({ id: l.id, name: l.name, recipeIds: l.recipeIds, createdAt: l.createdAt, items: l.GroceryItems.map(itemJson) });
  const ownedList = async (c, user, id) => {
    const list = await data.listWithItems(c.env.DB, id, user.id);
    if (!list) throw new AppError(404, 'We could not find that shopping list.');
    return list;
  };

  app.post('/api/grocery', async (c) => {
    const user = await requireUser(c);
    const { recipeIds, name } = await body(c, schemas.groceryCreate);
    const recipes = await data.recipesByIds(c.env.DB, recipeIds);
    if (recipes.length !== recipeIds.length) throw new AppError(404, 'One of those recipes no longer exists.');
    const lines = recipes.flatMap((r) => r.Ingredients.map((i) => ({ name: i.name, measure: i.measure || '' })));
    const merged = aggregate(lines);
    const list = await data.createList(c.env.DB, user.id, name, recipeIds,
      merged.map((m) => ({ name: m.name, quantity: m.quantity, unit: m.unit, aisle: m.aisle })));
    return c.json({ list: listJson(list), stats: { ingredientLines: lines.length, shoppingItems: merged.length } }, 201);
  });

  app.get('/api/grocery', async (c) => {
    const user = await requireUser(c);
    return c.json({ lists: await data.listsWithCounts(c.env.DB, user.id) });
  });

  app.get('/api/grocery/:id', async (c) => {
    const user = await requireUser(c);
    return c.json({ list: listJson(await ownedList(c, user, params(c, schemas.idParam).id)) });
  });

  app.patch('/api/grocery/:id/items/:itemId', async (c) => {
    const user = await requireUser(c);
    const p = params(c, schemas.groceryItem);
    const { checked } = await body(c, schemas.groceryItemPatch);
    const list = await ownedList(c, user, p.id);
    const item = list.GroceryItems.find((i) => i.id === p.itemId);
    if (!item) throw new AppError(404, 'We could not find that item.');
    await data.setItemChecked(c.env.DB, item.id, checked);
    return c.json({ item: itemJson({ ...item, checked }) });
  });

  app.delete('/api/grocery/:id', async (c) => {
    const user = await requireUser(c);
    const list = await ownedList(c, user, params(c, schemas.idParam).id);
    await data.deleteList(c.env.DB, list.id);
    return c.body(null, 204);
  });

  // ---- search / recipes ----
  app.post('/api/search', async (c) => {
    const user = await optionalUser(c);
    const input = await body(c, schemas.search);
    if (input.provider === 'ai') await aiLimit(c);
    if (!input.diet && user) input.diet = user.dietPrefs;
    const db = c.env.DB;
    const result = await runSearch({
      searchLocal: (parsed) => data.searchLocalRecipes(db, parsed),
      mealdb: providers.mealdb(db),
      saveRecipe: (dto) => data.saveRecipe(db, dto),
      suggestRecipes: (p) => ai.suggestRecipes(c.env, p),
    }, input);
    if (user && result.results.length > 0) {
      const favs = await data.favouriteIdsAmong(db, user.id, result.results.map((r) => r.id));
      result.results.forEach((r) => { r.isFavourite = favs.has(r.id); });
    }
    return c.json(result);
  });

  app.get('/api/recipes/:id', async (c) => {
    const user = await optionalUser(c);
    const { id } = params(c, schemas.idParam);
    const recipe = await data.recipeById(c.env.DB, id);
    if (!recipe) throw new AppError(404, 'We could not find that recipe.');
    const out = formatRecipe(recipe);
    if (user) out.isFavourite = await data.isFavourite(c.env.DB, user.id, id);
    return c.json(out);
  });

  app.get('/api/recipes/:id/pairing', async (c) => {
    const { id } = params(c, schemas.idParam);
    if (!(await data.recipeExists(c.env.DB, id))) throw new AppError(404, 'We could not find that recipe.');
    let drink = null;
    try { drink = await providers.pairingFor(c.env.DB, id); } catch { drink = null; }
    return c.json({ drink });
  });

  app.get('/api/ai/status', (c) => c.json({ configured: ai.isConfigured(c.env) }));

  // ---- pantry ----
  app.get('/api/pantry', async (c) => {
    const user = await requireUser(c);
    return c.json({ items: await data.pantryItems(c.env.DB, user.id) });
  });

  app.post('/api/pantry', async (c) => {
    const user = await requireUser(c);
    const { name } = await body(c, schemas.pantryAdd);
    const { display } = normalizeName(name);
    if (!display) throw new AppError(400, 'Please type an ingredient name.');
    const { item, created } = await data.addPantryItem(c.env.DB, user.id, display);
    return c.json({ item }, created ? 201 : 200);
  });

  app.get('/api/pantry/match', async (c) => {
    const user = await requireUser(c);
    const pantry = (await data.pantryItems(c.env.DB, user.id)).map((p) => normalizeName(p.name).key).filter(Boolean);
    if (pantry.length === 0) return c.json({ recipes: [] });
    return c.json({ recipes: rankPantry(pantry, await data.allRecipes(c.env.DB), user.dietPrefs) });
  });

  app.delete('/api/pantry/:id', async (c) => {
    const user = await requireUser(c);
    await data.deletePantryItem(c.env.DB, user.id, params(c, schemas.idParam).id);
    return c.body(null, 204);
  });

  // ---- meal planner ----
  app.post('/api/mealplan', async (c) => {
    const user = await requireUser(c);
    const { days, provider, usePantry } = await body(c, schemas.mealPlan);
    if (provider === 'ai') await aiLimit(c);
    const db = c.env.DB;
    const pantryNames = usePantry ? (await data.pantryItems(db, user.id)).map((p) => normalizeName(p.name).key) : [];

    const recipes = await data.allRecipes(db, { excludeCategories: ['Dessert', 'Breakfast'] });
    let pool = recipes.filter((r) => matchesPrefs(r, user.dietPrefs));
    if (pantryNames.length > 0) {
      const score = (r) => r.Ingredients.filter((i) => pantryNames.some((p) => i.name.toLowerCase().includes(p))).length;
      pool = [...pool].sort((a, b) => score(b) - score(a));
    }
    if (pool.length === 0) throw new AppError(422, 'No recipes match your dietary profile yet. Try relaxing a filter.');

    const byId = new Map(pool.map((r) => [r.id, r]));
    const candidates = pool.slice(0, 40).map((r) => ({ id: r.id, title: r.title, category: r.category, calories: r.calories }));
    let steps;
    let generatedBy = 'local';
    if (provider === 'ai' && ai.isConfigured(c.env)) {
      try {
        steps = await ai.planMeals(c.env, { candidates, days, prefs: user.dietPrefs, pantry: pantryNames });
        generatedBy = 'ai';
      } catch (err) {
        if (!(err instanceof ai.AiUnavailableError)) throw err;
      }
    }
    if (!steps) steps = buildLocalPlan(candidates, days, hash(`${user.id}:${days}:${Date.now()}`));
    const saved = await data.createPlan(db, user.id, days, steps, generatedBy);
    return c.json(hydrate(saved, byId), 201);
  });

  app.get('/api/mealplan', async (c) => {
    const user = await requireUser(c);
    const plan = await data.latestPlanRow(c.env.DB, user.id);
    if (!plan) return c.json({ plan: null });
    const ids = [...new Set(plan.plan.flatMap((d) => [d.lunch, d.dinner]))];
    const recipes = await data.recipesByIds(c.env.DB, ids);
    return c.json({ plan: hydrate(plan, new Map(recipes.map((r) => [r.id, r]))) });
  });

  app.all('/api/*', (c) => c.json({ error: { message: 'That page does not exist.' } }, 404));

  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: { message: err.message, details: err.details } }, err.status);
    if (err instanceof UpstreamError) return c.json({ error: { message: 'A recipe service is not answering right now. Please try again.' } }, 502);
    console.error(err);
    return c.json({ error: { message: 'Something went wrong on our side. Please try again.' } }, 500);
  });

  return app;
}

module.exports = { createApp, AppError };
