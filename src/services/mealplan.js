const { Op } = require('sequelize');
const { Recipe, MealPlan } = require('../models');
const { matchesPrefs } = require('./diet');
const { withIngredients } = require('./recipeStore');
const { hash, shuffle, buildLocalPlan, hydrate } = require('./planner');
const gemini = require('./gemini');
const { AppError } = require('../middleware/error');

async function candidateRecipes(prefs, pantryNames = []) {
  const recipes = await Recipe.findAll({
    where: { category: { [Op.notIn]: ['Dessert', 'Breakfast'] } },
    ...withIngredients,
  });
  let pool = recipes.filter((r) => matchesPrefs(r, prefs));
  if (pantryNames.length > 0) {
    // Float recipes that use pantry items to the front, but keep the rest as filler.
    const score = (r) => r.Ingredients.filter((i) => pantryNames.some((p) => i.name.toLowerCase().includes(p))).length;
    pool = [...pool].sort((a, b) => score(b) - score(a));
  }
  return pool;
}

async function generatePlan({ user, days, provider, pantryNames }) {
  const prefs = user.dietPrefs;
  const pool = await candidateRecipes(prefs, pantryNames);
  if (pool.length === 0) throw new AppError(422, 'No recipes match your dietary profile yet. Try relaxing a filter.');

  const byId = new Map(pool.map((r) => [r.id, r]));
  const candidates = pool.slice(0, 40).map((r) => ({ id: r.id, title: r.title, category: r.category, calories: r.calories }));

  let steps;
  let generatedBy = 'local';
  if (provider === 'ai' && gemini.isConfigured()) {
    try {
      steps = await gemini.planMeals({ candidates, days, prefs, pantry: pantryNames });
      generatedBy = 'ai';
    } catch (err) {
      if (!(err instanceof gemini.AiUnavailableError)) throw err;
    }
  }
  if (!steps) steps = buildLocalPlan(candidates, days, hash(`${user.id}:${days}:${Date.now()}`));

  const saved = await MealPlan.create({ UserId: user.id, days, plan: steps, generatedBy });
  return hydrate(saved, byId);
}

async function latestPlan(user) {
  const plan = await MealPlan.findOne({ where: { UserId: user.id }, order: [['id', 'DESC']] });
  if (!plan) return null;
  const ids = [...new Set(plan.plan.flatMap((d) => [d.lunch, d.dinner]))];
  const recipes = await Recipe.findAll({ where: { id: ids }, ...withIngredients });
  return hydrate(plan, new Map(recipes.map((r) => [r.id, r])));
}

module.exports = { generatePlan, latestPlan, buildLocalPlan, shuffle };
