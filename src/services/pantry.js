const { Recipe, PantryItem } = require('../models');
const { normalizeName } = require('./grocery');
const { containsTerm, matchesPrefs } = require('./diet');
const { formatRecipe, withIngredients } = require('./recipeStore');

// Things every kitchen has; they should not count against "can I cook this?".
const STAPLES = new Set(['salt', 'water', 'black pepper', 'ice', 'cooking oil', 'vegetable oil']);

/** Is `have` (a pantry entry) the same ingredient as `need` (a recipe line)? "chicken" covers "chicken thigh". */
function covers(have, need) {
  return have === need || containsTerm(need, [have]) || containsTerm(have, [need]);
}

/**
 * Rank recipes by how much of their ingredient list the pantry already covers.
 * Returns recipes with `have`, `missing` and `coverage` (0..1), best first.
 */
async function matchPantry(userId, prefs = {}, { limit = 12, minCoverage = 0.3 } = {}) {
  const pantry = (await PantryItem.findAll({ where: { UserId: userId } }))
    .map((p) => normalizeName(p.name).key)
    .filter(Boolean);
  if (pantry.length === 0) return [];

  const recipes = await Recipe.findAll(withIngredients);
  const ranked = [];
  for (const recipe of recipes) {
    if (!matchesPrefs(recipe, prefs)) continue;
    const needs = recipe.Ingredients
      .map((i) => normalizeName(i.name))
      .filter((n) => n.key && !STAPLES.has(n.key));
    if (needs.length === 0) continue;

    const have = [];
    const missing = [];
    for (const need of needs) {
      (pantry.some((p) => covers(p, need.key)) ? have : missing).push(need.display);
    }
    const coverage = have.length / needs.length;
    if (have.length > 0 && coverage >= minCoverage) {
      ranked.push({ ...formatRecipe(recipe), have, missing, coverage: Math.round(coverage * 100) / 100 });
    }
  }
  return ranked
    .sort((a, b) => b.coverage - a.coverage || a.missing.length - b.missing.length || a.title.localeCompare(b.title))
    .slice(0, limit);
}

module.exports = { matchPantry, covers, STAPLES };
