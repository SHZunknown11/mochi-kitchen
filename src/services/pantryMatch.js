const { normalizeName } = require('./grocery');
const { ingredientMatches, matchesPrefs } = require('./diet');
const { formatRecipe } = require('./recipeFormat');

// Things every kitchen has; they should not count against "can I cook this?".
const STAPLES = new Set(['salt', 'water', 'black pepper', 'ice', 'cooking oil', 'vegetable oil']);

/** Is `have` (a pantry entry) the same ingredient as `need` (a recipe line)? "chicken" covers "chicken thigh". */
function covers(have, need) {
  return have === need || ingredientMatches(need, have) || ingredientMatches(have, need);
}

/**
 * Rank recipes by how much of their ingredient list the pantry already covers.
 * `pantry` is a list of normalised keys; `recipes` need an `Ingredients` array.
 */
function rankPantry(pantry, recipes, prefs = {}, { limit = 12, minCoverage = 0.3 } = {}) {
  if (pantry.length === 0) return [];
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

module.exports = { STAPLES, covers, rankPantry };
