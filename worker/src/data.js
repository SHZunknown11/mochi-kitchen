// All D1 access (plain SQL). Rows are shaped like the Sequelize objects the shared services expect.
const { classifyIngredients, estimateCalories } = require('../../src/services/diet');
const { parseMeasure } = require('../../src/services/grocery');

const MAX_PLAUSIBLE_KCAL = 1400;
const CHUNK = 80; // D1 allows at most 100 bound parameters per statement

const iso = () => new Date().toISOString();
const jsonOr = (text, fallback) => { try { return JSON.parse(text); } catch { return fallback; } };
const marks = (n) => Array(n).fill('?').join(',');
const chunks = (list) => { const out = []; for (let i = 0; i < list.length; i += CHUNK) out.push(list.slice(i, i + CHUNK)); return out; };

const all = async (db, sql, ...p) => (await db.prepare(sql).bind(...p).all()).results;
const first = (db, sql, ...p) => db.prepare(sql).bind(...p).first();
const run = (db, sql, ...p) => db.prepare(sql).bind(...p).run();

// ---- users -----------------------------------------------------------------
const DEFAULT_PREFS = { diet: 'none', glutenFree: false, maxCalories: null };
const toUser = (r) => r && ({ ...r, dietPrefs: jsonOr(r.dietPrefs, DEFAULT_PREFS) });

const userById = async (db, id) => toUser(await first(db, 'SELECT * FROM users WHERE id = ?', id));
const userByIdentifier = async (db, id) => toUser(await first(db, 'SELECT * FROM users WHERE email = ? OR username = ?', id.toLowerCase(), id));
const userClash = (db, email, username) => first(db, 'SELECT email, username FROM users WHERE email = ? OR username = ?', email, username);

async function createUser(db, { username, email, passwordHash }) {
  const t = iso();
  const res = await run(db, 'INSERT INTO users (username, email, passwordHash, dietPrefs, createdAt, updatedAt) VALUES (?,?,?,?,?,?)',
    username, email, passwordHash, JSON.stringify(DEFAULT_PREFS), t, t);
  return userById(db, res.meta.last_row_id);
}
const setDietPrefs = (db, id, prefs) => run(db, 'UPDATE users SET dietPrefs = ?, updatedAt = ? WHERE id = ?', JSON.stringify(prefs), iso(), id);

// ---- refresh tokens ----------------------------------------------------------
const addRefreshToken = (db, userId, tokenHash, expiresAt) => {
  const t = iso();
  return run(db, 'INSERT INTO refresh_tokens (tokenHash, expiresAt, revoked, UserId, createdAt, updatedAt) VALUES (?,?,0,?,?,?)', tokenHash, expiresAt, userId, t, t);
};
const refreshByHash = (db, hash) => first(db, 'SELECT * FROM refresh_tokens WHERE tokenHash = ?', hash);
const revokeToken = (db, hash) => run(db, 'UPDATE refresh_tokens SET revoked = 1, updatedAt = ? WHERE tokenHash = ?', iso(), hash);
const revokeAllTokens = (db, userId) => run(db, 'UPDATE refresh_tokens SET revoked = 1, updatedAt = ? WHERE UserId = ?', iso(), userId);

// ---- recipes ----------------------------------------------------------------
const toRecipe = (r, ingredients = []) => ({
  ...r,
  isVegetarian: !!r.isVegetarian,
  isVegan: !!r.isVegan,
  isGlutenFree: !!r.isGlutenFree,
  tags: jsonOr(r.tags, []),
  Ingredients: ingredients,
});

/** Recipes (with their ingredients, in insertion order) for the given ids, keeping the order asked for. */
async function recipesByIds(db, ids) {
  if (ids.length === 0) return [];
  const recipes = [];
  const ings = [];
  for (const part of chunks([...new Set(ids)])) {
    recipes.push(...await all(db, `SELECT * FROM recipes WHERE id IN (${marks(part.length)})`, ...part));
    ings.push(...await all(db, `SELECT * FROM ingredients WHERE RecipeId IN (${marks(part.length)}) ORDER BY id`, ...part));
  }
  const by = new Map();
  for (const i of ings) { if (!by.has(i.RecipeId)) by.set(i.RecipeId, []); by.get(i.RecipeId).push(i); }
  const rows = new Map(recipes.map((r) => [r.id, toRecipe(r, by.get(r.id) || [])]));
  return ids.map((id) => rows.get(id)).filter(Boolean);
}

async function recipeById(db, id) {
  return (await recipesByIds(db, [id]))[0] || null;
}

async function allRecipes(db, { excludeCategories = [], limit } = {}) {
  const where = excludeCategories.length ? `WHERE category NOT IN (${marks(excludeCategories.length)})` : '';
  const sql = `SELECT id FROM recipes ${where} ORDER BY id ${limit ? 'LIMIT ?' : ''}`;
  const ids = (await all(db, sql, ...excludeCategories, ...(limit ? [limit] : []))).map((r) => r.id);
  return recipesByIds(db, ids);
}

/** Local search: any term found in title/area/category/summary or in an ingredient name. */
async function searchLocalRecipes(db, parsed) {
  const terms = [...new Set([...parsed.ingredients, ...parsed.other, ...parsed.mealTypes, ...parsed.cuisines, ...parsed.flavours])].slice(0, 25);
  if (terms.length === 0) return allRecipes(db, { limit: 200 });

  const ids = new Set();
  const hay = "(title || ' ' || ifnull(area,'') || ' ' || ifnull(category,'') || ' ' || ifnull(summary,''))";
  const byRecipe = await all(db, `SELECT id FROM recipes WHERE ${terms.map(() => `${hay} LIKE ?`).join(' OR ')} LIMIT 300`,
    ...terms.map((t) => `%${t}%`));
  byRecipe.forEach((r) => ids.add(r.id));

  const ingTerms = parsed.ingredients.slice(0, 25);
  if (ingTerms.length > 0) {
    const byIng = await all(db, `SELECT DISTINCT RecipeId FROM ingredients WHERE ${ingTerms.map(() => 'name LIKE ?').join(' OR ')} LIMIT 300`,
      ...ingTerms.map((t) => `%${t}%`));
    byIng.forEach((i) => ids.add(i.RecipeId));
  }
  return recipesByIds(db, [...ids]);
}

/**
 * Save a recipe from any source. Diet flags are always computed by our classifier. If the recipe
 * already exists (same source + externalId) the stored copy is returned unchanged.
 */
async function saveRecipe(db, dto) {
  const find = () => first(db, 'SELECT id FROM recipes WHERE source = ? AND externalId = ?', dto.source, dto.externalId);
  let row = await find();
  if (row) return recipeById(db, row.id);

  const diet = classifyIngredients(dto.ingredients.map((i) => i.name));
  let calories = Number.isFinite(dto.calories) ? Math.round(dto.calories) : null;
  let caloriesSource = calories !== null ? 'ai' : null;
  if (calories === null) {
    calories = estimateCalories(dto.ingredients, dto.servings || 4);
    if (calories !== null && calories > MAX_PLAUSIBLE_KCAL) calories = null;
    caloriesSource = calories !== null ? 'estimate' : null;
  }

  const t = iso();
  const ingredients = dto.ingredients.map((i) => {
    const p = parseMeasure(i.measure);
    return { name: i.name.slice(0, 120), measure: i.measure ? i.measure.slice(0, 80) : null, quantity: p.quantity, unit: p.unit };
  });
  // One atomic batch. If a concurrent request already saved it, the recipe insert is ignored and
  // changes() is 0, so the ingredient insert adds nothing (no duplicate ingredients).
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO recipes (source, externalId, title, category, area, summary, instructions, thumb, youtube,
        calories, caloriesSource, isVegetarian, isVegan, isGlutenFree, tags, createdAt, updatedAt)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      dto.source, dto.externalId, dto.title.slice(0, 160), dto.category || null, dto.area || null, dto.summary || null,
      dto.instructions || 'No instructions provided.', dto.thumb || null, dto.youtube || null, calories, caloriesSource,
      diet.isVegetarian ? 1 : 0, diet.isVegan ? 1 : 0, diet.isGlutenFree ? 1 : 0, JSON.stringify(dto.tags || []), t, t),
    db.prepare(`INSERT INTO ingredients (name, measure, quantity, unit, RecipeId, createdAt, updatedAt)
        SELECT json_extract(j.value,'$.name'), json_extract(j.value,'$.measure'), json_extract(j.value,'$.quantity'),
               json_extract(j.value,'$.unit'), r.id, ?, ?
        FROM json_each(?) j, (SELECT id FROM recipes WHERE source = ? AND externalId = ?) r
        WHERE changes() > 0`).bind(t, t, JSON.stringify(ingredients), dto.source, dto.externalId),
  ]);
  row = await find();
  return recipeById(db, row.id);
}

// ---- favourites ---------------------------------------------------------------
async function favouriteRecipes(db, userId) {
  const ids = (await all(db, 'SELECT RecipeId FROM favourites WHERE UserId = ? ORDER BY id DESC', userId)).map((r) => r.RecipeId);
  return recipesByIds(db, ids);
}
async function favouriteIdsAmong(db, userId, recipeIds) {
  const found = new Set();
  for (const part of chunks(recipeIds)) {
    (await all(db, `SELECT RecipeId FROM favourites WHERE UserId = ? AND RecipeId IN (${marks(part.length)})`, userId, ...part))
      .forEach((r) => found.add(r.RecipeId));
  }
  return found;
}
const isFavourite = async (db, userId, recipeId) => Boolean(await first(db, 'SELECT id FROM favourites WHERE UserId = ? AND RecipeId = ?', userId, recipeId));
async function addFavourite(db, userId, recipeId) {
  const t = iso();
  const res = await run(db, 'INSERT OR IGNORE INTO favourites (UserId, RecipeId, createdAt, updatedAt) VALUES (?,?,?,?)', userId, recipeId, t, t);
  return res.meta.changes > 0;
}
const removeFavourite = (db, userId, recipeId) => run(db, 'DELETE FROM favourites WHERE UserId = ? AND RecipeId = ?', userId, recipeId);
const recipeExists = async (db, id) => Boolean(await first(db, 'SELECT id FROM recipes WHERE id = ?', id));

// ---- grocery ------------------------------------------------------------------
const toItem = (i) => ({ ...i, checked: !!i.checked });
async function listWithItems(db, id, userId) {
  const list = await first(db, 'SELECT * FROM grocery_lists WHERE id = ? AND UserId = ?', id, userId);
  if (!list) return null;
  const items = await all(db, 'SELECT * FROM grocery_items WHERE GroceryListId = ? ORDER BY id', id);
  return { ...list, recipeIds: jsonOr(list.recipeIds, []), GroceryItems: items.map(toItem) };
}
async function createList(db, userId, name, recipeIds, items) {
  const t = iso();
  const res = await run(db, 'INSERT INTO grocery_lists (name, recipeIds, UserId, createdAt, updatedAt) VALUES (?,?,?,?,?)', name, JSON.stringify(recipeIds), userId, t, t);
  const id = res.meta.last_row_id;
  if (items.length > 0) {
    await run(db, `INSERT INTO grocery_items (name, quantity, unit, aisle, checked, GroceryListId, createdAt, updatedAt)
        SELECT json_extract(value,'$.name'), json_extract(value,'$.quantity'), json_extract(value,'$.unit'),
               json_extract(value,'$.aisle'), 0, ?, ?, ? FROM json_each(?)`, id, t, t, JSON.stringify(items));
  }
  return listWithItems(db, id, userId);
}
async function listsWithCounts(db, userId) {
  return all(db, `SELECT l.id, l.name, l.createdAt,
      (SELECT COUNT(*) FROM grocery_items WHERE GroceryListId = l.id) AS total,
      (SELECT COUNT(*) FROM grocery_items WHERE GroceryListId = l.id AND checked = 1) AS done
      FROM grocery_lists l WHERE l.UserId = ? ORDER BY l.id DESC`, userId);
}
const setItemChecked = (db, itemId, checked) => run(db, 'UPDATE grocery_items SET checked = ?, updatedAt = ? WHERE id = ?', checked ? 1 : 0, iso(), itemId);
const deleteList = (db, id) => run(db, 'DELETE FROM grocery_lists WHERE id = ?', id);

// ---- pantry ---------------------------------------------------------------------
const pantryItems = (db, userId) => all(db, 'SELECT id, name FROM pantry_items WHERE UserId = ? ORDER BY name', userId);
async function addPantryItem(db, userId, name) {
  const t = iso();
  const res = await run(db, 'INSERT OR IGNORE INTO pantry_items (name, UserId, createdAt, updatedAt) VALUES (?,?,?,?)', name, userId, t, t);
  const item = await first(db, 'SELECT id, name FROM pantry_items WHERE UserId = ? AND name = ?', userId, name);
  return { item, created: res.meta.changes > 0 };
}
const deletePantryItem = (db, userId, id) => run(db, 'DELETE FROM pantry_items WHERE id = ? AND UserId = ?', id, userId);

// ---- meal plans -----------------------------------------------------------------
const toPlan = (r) => r && ({ ...r, plan: jsonOr(r.plan, []) });
async function createPlan(db, userId, days, plan, generatedBy) {
  const t = iso();
  const res = await run(db, 'INSERT INTO meal_plans (days, plan, generatedBy, UserId, createdAt, updatedAt) VALUES (?,?,?,?,?,?)', days, JSON.stringify(plan), generatedBy, userId, t, t);
  return toPlan(await first(db, 'SELECT * FROM meal_plans WHERE id = ?', res.meta.last_row_id));
}
const latestPlanRow = async (db, userId) => toPlan(await first(db, 'SELECT * FROM meal_plans WHERE UserId = ? ORDER BY id DESC LIMIT 1', userId));

// ---- API cache + rate limits -----------------------------------------------------
async function cached(db, key, loader, ttlMs) {
  const safeKey = key.slice(0, 200);
  const hit = await first(db, 'SELECT payload, expiresAt FROM api_cache WHERE key = ?', safeKey);
  if (hit && hit.expiresAt > iso()) {
    try { return JSON.parse(hit.payload); } catch { /* refresh a corrupt entry */ }
  }
  const value = await loader();
  await run(db, 'INSERT INTO api_cache (key, payload, expiresAt) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, expiresAt = excluded.expiresAt',
    safeKey, JSON.stringify(value), new Date(Date.now() + ttlMs).toISOString());
  if (Math.random() < 0.02) await run(db, 'DELETE FROM api_cache WHERE expiresAt < ?', iso()); // tidy up now and then
  return value;
}

/** Fixed-window counter in D1. Returns the count including this hit. */
async function hit(db, key, windowMs) {
  const win = Math.floor(Date.now() / windowMs);
  const row = await first(db, `INSERT INTO rate_limits (key, windowStart, count) VALUES (?, ?, 1)
      ON CONFLICT(key) DO UPDATE SET count = CASE WHEN windowStart = excluded.windowStart THEN count + 1 ELSE 1 END,
      windowStart = excluded.windowStart RETURNING count`, key, win);
  if (Math.random() < 0.01) await run(db, 'DELETE FROM rate_limits WHERE windowStart < ?', win - 1);
  return row.count;
}

module.exports = {
  iso, userById, userByIdentifier, userClash, createUser, setDietPrefs,
  addRefreshToken, refreshByHash, revokeToken, revokeAllTokens,
  recipesByIds, recipeById, allRecipes, searchLocalRecipes, saveRecipe, recipeExists,
  favouriteRecipes, favouriteIdsAmong, isFavourite, addFavourite, removeFavourite,
  listWithItems, createList, listsWithCounts, setItemChecked, deleteList,
  pantryItems, addPantryItem, deletePantryItem, createPlan, latestPlanRow, cached, hit,
};
