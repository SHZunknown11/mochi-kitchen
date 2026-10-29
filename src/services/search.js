const { Op } = require('sequelize');
const { Recipe, Ingredient } = require('../models');
const { extractKeywords } = require('./nlp');
const { matchesPrefs, containsTerm } = require('./diet');
const { saveRecipe, formatRecipe, withIngredients } = require('./recipeStore');
const mealdb = require('./providers/mealdb');
const gemini = require('./gemini');

const MAX_RESULTS = 24;
const MAX_REMOTE_LOOKUPS = 10;

const like = (term) => ({ [Op.like]: `%${term}%` });
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Combine what the user ticked (explicit) with what the sentence said (parsed). Explicit wins. */
function mergePrefs(explicit = {}, parsed) {
  return {
    diet: explicit.diet && explicit.diet !== 'none' ? explicit.diet : parsed.diet.diet,
    glutenFree: Boolean(explicit.glutenFree || parsed.diet.glutenFree),
    maxCalories: explicit.maxCalories || parsed.maxCalories || null,
  };
}

/** How well does a stored recipe match the parsed request? Returns { score, matched }. */
function scoreRecipe(recipe, parsed) {
  const names = (recipe.Ingredients || []).map((i) => i.name);
  const title = recipe.title.toLowerCase();
  const matched = [];
  let score = 0;

  for (const ing of parsed.ingredients) {
    if (names.some((n) => containsTerm(n, [ing]))) { score += 3; matched.push(ing); }
    else if (containsTerm(title, [ing])) { score += 2; matched.push(ing); }
  }
  for (const k of [...parsed.other, ...parsed.mealTypes]) {
    if (title.includes(k)) { score += 4; matched.push(k); }
    else if ((recipe.category || '').toLowerCase() === k) { score += 2; matched.push(k); }
    else if ((recipe.tags || []).some((t) => t.toLowerCase().includes(k))) { score += 1; matched.push(k); }
  }
  for (const c of parsed.cuisines) {
    if ((recipe.area || '').toLowerCase().startsWith(c)) { score += 2; matched.push(c); }
  }
  for (const f of parsed.flavours) {
    const text = `${title} ${recipe.summary || ''} ${(recipe.tags || []).join(' ')}`.toLowerCase();
    if (text.includes(f)) { score += 1; matched.push(f); }
  }
  return { score, matched: [...new Set(matched)] };
}

/** Recipes already in our database (seed data plus everything cached from earlier searches). */
async function searchLocal(parsed) {
  const terms = [...parsed.ingredients, ...parsed.other, ...parsed.mealTypes, ...parsed.cuisines, ...parsed.flavours];
  if (terms.length === 0) {
    return Recipe.findAll({ ...withIngredients, limit: 200 });
  }

  const ids = new Set();
  const byRecipe = await Recipe.findAll({
    attributes: ['id'],
    where: {
      [Op.or]: terms.flatMap((t) => [{ title: like(t) }, { area: like(t) }, { category: like(t) }, { summary: like(t) }]),
    },
    limit: 300,
  });
  byRecipe.forEach((r) => ids.add(r.id));

  if (parsed.ingredients.length > 0) {
    const byIngredient = await Ingredient.findAll({
      attributes: ['RecipeId'],
      where: { [Op.or]: parsed.ingredients.map((i) => ({ name: like(i) })) },
      group: ['RecipeId'],
      limit: 300,
    });
    byIngredient.forEach((i) => ids.add(i.RecipeId));
  }
  if (ids.size === 0) return [];
  return Recipe.findAll({ where: { id: [...ids] }, ...withIngredients });
}

/** TheMealDB lookups. Rejections are swallowed one by one so a single failure doesn't hide the rest. */
async function searchFree(parsed) {
  const found = new Map(); // externalId -> { dto?, score }
  const bump = (id, points, dto) => {
    const cur = found.get(id) || { score: 0 };
    found.set(id, { score: cur.score + points, dto: dto || cur.dto });
  };
  let failures = 0;
  let attempts = 0;
  const track = async (promise, onOk) => {
    attempts += 1;
    try { onOk(await promise); } catch { failures += 1; }
  };

  const jobs = [];
  parsed.ingredients.slice(0, 3).forEach((ing) => jobs.push(track(mealdb.filterByIngredient(ing),
    (list) => list.forEach((m) => bump(m.idMeal, 3)))));
  parsed.cuisines.slice(0, 1).forEach((c) => jobs.push(track(mealdb.filterByArea(cap(c)),
    (list) => list.forEach((m) => bump(m.idMeal, 2)))));
  [...parsed.other, ...parsed.mealTypes].slice(0, 3).forEach((k) => jobs.push(track(mealdb.searchByName(k),
    (list) => list.forEach((dto) => bump(dto.externalId, 4, dto)))));
  await Promise.all(jobs);

  const ranked = [...found.entries()].sort((a, b) => b[1].score - a[1].score).slice(0, MAX_REMOTE_LOOKUPS);
  const dtos = [];
  await Promise.all(ranked.map(([id, entry]) => track(entry.dto ? Promise.resolve(entry.dto) : mealdb.lookup(id),
    (dto) => { if (dto) dtos.push(dto); })));

  const saved = [];
  for (const dto of dtos) saved.push(await saveRecipe(dto));
  return { recipes: saved, unavailable: attempts > 0 && failures === attempts };
}

/**
 * Main search. `mode` only affects how the request is parsed:
 *   text         - free sentence, parsed by the NLP layer
 *   ingredients  - a list of ingredient names
 *   diet         - no keywords, just the dietary filters (browse mode)
 * `provider` is 'free' (database + TheMealDB) or 'ai' (Gemini ideas first, then the free results).
 */
async function search({ mode = 'text', query = '', ingredients = [], diet = {}, provider = 'free' }) {
  const parsed = mode === 'ingredients'
    ? { ...extractKeywords(''), ingredients: ingredients.map((i) => i.toLowerCase().trim()).filter(Boolean) }
    : mode === 'diet' ? extractKeywords('') : extractKeywords(query);
  parsed.keywords = [...new Set([...parsed.ingredients, ...parsed.cuisines, ...parsed.mealTypes, ...parsed.flavours, ...parsed.other])];

  const prefs = mergePrefs(diet, parsed);
  const notices = [];
  const results = new Map(); // recipe id -> { recipe, score, matched, ai }
  const add = (recipe, score, matched, ai = false) => {
    const prev = results.get(recipe.id);
    if (!prev || prev.score < score) results.set(recipe.id, { recipe, score, matched, ai });
  };

  if (provider === 'ai') {
    try {
      const ideas = await gemini.suggestRecipes({ ...parsed, diet: prefs, maxCalories: prefs.maxCalories });
      for (const dto of ideas) {
        const saved = await saveRecipe(dto);
        add(saved, 100, parsed.keywords, true);
      }
    } catch (err) {
      if (!(err instanceof gemini.AiUnavailableError)) throw err;
      notices.push('ai-unavailable');
    }
  }

  const local = await searchLocal(parsed);
  for (const recipe of local) {
    const { score, matched } = scoreRecipe(recipe, parsed);
    if (score > 0 || parsed.keywords.length === 0) add(recipe, score, matched);
  }

  if (parsed.keywords.length > 0) {
    const free = await searchFree(parsed);
    if (free.unavailable) notices.push('free-api-unavailable');
    for (const recipe of free.recipes) {
      const { score, matched } = scoreRecipe(recipe, parsed);
      add(recipe, Math.max(score, 1), matched);
    }
  }

  const list = [...results.values()]
    .filter(({ recipe }) => matchesPrefs(recipe, prefs))
    .sort((a, b) => b.score - a.score || a.recipe.title.localeCompare(b.recipe.title))
    .slice(0, MAX_RESULTS)
    .map(({ recipe, score, matched, ai }) => ({ ...formatRecipe(recipe), score, matched, ai }));

  return {
    parsed: {
      keywords: parsed.keywords,
      ingredients: parsed.ingredients,
      cuisines: parsed.cuisines,
      mealTypes: parsed.mealTypes,
      flavours: parsed.flavours,
    },
    prefs,
    notices,
    results: list,
  };
}

module.exports = { search, scoreRecipe, mergePrefs };
