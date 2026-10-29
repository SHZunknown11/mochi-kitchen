const { Op } = require('sequelize');
const { Recipe, MealPlan } = require('../models');
const { matchesPrefs } = require('./diet');
const { formatRecipe, withIngredients } = require('./recipeStore');
const gemini = require('./gemini');
const { AppError } = require('../middleware/error');

const NOTES = [
  'A cosy one for after a long day.',
  'Simple, tasty and kind to the washing-up.',
  'Something fresh to keep things interesting.',
  'Treat yourself, you earned it.',
  'A warm bowl always helps.',
  'Cook together if you can.',
  'Leftovers tomorrow, hooray.',
];

/** Small deterministic hash so the same user + day count gives a stable (but varied) plan. */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffle(list, seed) {
  const out = [...list];
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i -= 1) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Plan lunches from the lighter half of the candidates and dinners from the heavier half,
 * never repeating a recipe until the pool is used up. Works with no AI at all.
 */
function buildLocalPlan(candidates, days, seed = 1) {
  const sorted = [...candidates].sort((a, b) => (a.calories ?? 9999) - (b.calories ?? 9999));
  const half = Math.ceil(sorted.length / 2);
  const lunchPool = shuffle(sorted.slice(0, half), seed);
  const dinnerPool = shuffle(sorted.slice(half).length ? sorted.slice(half) : sorted, seed + 7);

  const pick = (pool, i) => pool[i % pool.length].id;
  return Array.from({ length: days }, (_, i) => ({
    day: i + 1,
    lunch: pick(lunchPool, i),
    dinner: pick(dinnerPool, i),
    note: NOTES[(seed + i) % NOTES.length],
  }));
}

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

function hydrate(plan, byId) {
  const get = (id) => (byId.get(id) ? formatRecipe(byId.get(id)) : null);
  return {
    id: plan.id,
    days: plan.days,
    generatedBy: plan.generatedBy,
    createdAt: plan.createdAt,
    plan: plan.plan.map((d) => ({ day: d.day, note: d.note, lunch: get(d.lunch), dinner: get(d.dinner) })),
  };
}

async function latestPlan(user) {
  const plan = await MealPlan.findOne({ where: { UserId: user.id }, order: [['id', 'DESC']] });
  if (!plan) return null;
  const ids = [...new Set(plan.plan.flatMap((d) => [d.lunch, d.dinner]))];
  const recipes = await Recipe.findAll({ where: { id: ids }, ...withIngredients });
  return hydrate(plan, new Map(recipes.map((r) => [r.id, r])));
}

module.exports = { generatePlan, latestPlan, buildLocalPlan, shuffle };
