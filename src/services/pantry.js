const { Recipe, PantryItem } = require('../models');
const { normalizeName } = require('./grocery');
const { withIngredients } = require('./recipeStore');
const { STAPLES, covers, rankPantry } = require('./pantryMatch');

/** Rank stored recipes by how much of their ingredient list the user's pantry already covers. */
async function matchPantry(userId, prefs = {}, opts = {}) {
  const pantry = (await PantryItem.findAll({ where: { UserId: userId } }))
    .map((p) => normalizeName(p.name).key)
    .filter(Boolean);
  if (pantry.length === 0) return [];
  const recipes = await Recipe.findAll(withIngredients);
  return rankPantry(pantry, recipes, prefs, opts);
}

module.exports = { matchPantry, covers, STAPLES };
