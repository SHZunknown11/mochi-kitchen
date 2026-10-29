const { Op } = require('sequelize');
const { Recipe, Ingredient } = require('../models');
const { saveRecipe, withIngredients } = require('./recipeStore');
const mealdb = require('./providers/mealdb');
const gemini = require('./gemini');
const { scoreRecipe, mergePrefs } = require('./scoring');
const { runSearch } = require('./searchCore');

const like = (term) => ({ [Op.like]: `%${term}%` });

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


/**
 * Main search (see searchCore for the algorithm). `provider` is 'free' (database + TheMealDB)
 * or 'ai' (Gemini ideas first, then the free results).
 */
function search(input) {
  return runSearch({
    searchLocal, mealdb, saveRecipe, suggestRecipes: (p) => gemini.suggestRecipes(p),
  }, input);
}

module.exports = { search, scoreRecipe, mergePrefs };
