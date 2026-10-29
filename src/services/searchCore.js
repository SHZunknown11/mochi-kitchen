const { extractKeywords } = require('./nlp');
const { matchesPrefs } = require('./diet');
const { mergePrefs, scoreRecipe } = require('./scoring');
const { formatRecipe } = require('./recipeFormat');
const { AiUnavailableError } = require('./geminiCore');

const MAX_RESULTS = 24;
const MAX_REMOTE_LOOKUPS = 10;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** TheMealDB lookups. Rejections are swallowed one by one so a single failure doesn't hide the rest. */
async function searchFree(parsed, { mealdb, saveRecipe }) {
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

  // In parallel: each save is several database round trips, which add up when done one by one.
  const saved = await Promise.all(dtos.map((dto) => saveRecipe(dto)));
  return { recipes: saved, unavailable: attempts > 0 && failures === attempts };
}

/**
 * Main search. `mode` only affects how the request is parsed:
 *   text         - free sentence, parsed by the NLP layer
 *   ingredients  - a list of ingredient names
 *   diet         - no keywords, just the dietary filters (browse mode)
 * `provider` is 'free' (database + TheMealDB) or 'ai' (Gemini ideas first, then the free results).
 */
async function runSearch(deps, { mode = 'text', query = '', ingredients = [], diet = {}, provider = 'free' }) {
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
      const ideas = await deps.suggestRecipes({ ...parsed, diet: prefs, maxCalories: prefs.maxCalories });
      for (const dto of ideas) {
        const saved = await deps.saveRecipe(dto);
        add(saved, 100, parsed.keywords, true);
      }
    } catch (err) {
      if (!(err instanceof AiUnavailableError)) throw err;
      notices.push('ai-unavailable');
    }
  }

  const local = await deps.searchLocal(parsed);
  for (const recipe of local) {
    const { score, matched } = scoreRecipe(recipe, parsed);
    if (score > 0 || parsed.keywords.length === 0) add(recipe, score, matched);
  }

  if (parsed.keywords.length > 0) {
    const free = await searchFree(parsed, deps);
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

module.exports = { runSearch };
