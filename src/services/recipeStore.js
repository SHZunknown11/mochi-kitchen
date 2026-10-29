const { UniqueConstraintError } = require('sequelize');
const { sequelize, Recipe, Ingredient } = require('../models');
const { classifyIngredients, estimateCalories } = require('./diet');
const { parseMeasure } = require('./grocery');

const MAX_PLAUSIBLE_KCAL = 1400;

const withIngredients = { include: [{ model: Ingredient, order: [['id', 'ASC']] }], order: [[Ingredient, 'id', 'ASC']] };

/**
 * Save a recipe from any source (seed / TheMealDB / Gemini). Diet flags are always computed by
 * our own classifier so every source is judged the same way. If the recipe already exists
 * (same source + externalId) the stored copy is returned unchanged.
 */
let writeQueue = Promise.resolve();

/** Save one recipe at a time. SQLite has a single writer anyway, and this avoids overlapping transactions. */
function saveRecipe(dto) {
  const run = writeQueue.then(() => doSave(dto));
  writeQueue = run.catch(() => {});
  return run;
}

async function doSave(dto) {
  const existing = await Recipe.findOne({ where: { source: dto.source, externalId: dto.externalId }, ...withIngredients });
  if (existing) return existing;

  const diet = classifyIngredients(dto.ingredients.map((i) => i.name));
  let calories = Number.isFinite(dto.calories) ? Math.round(dto.calories) : null;
  let caloriesSource = calories !== null ? 'ai' : null;
  if (calories === null) {
    calories = estimateCalories(dto.ingredients, dto.servings || 4);
    // Free-text measures can be wildly off; an implausible per-serving figure is better left unknown.
    if (calories !== null && calories > MAX_PLAUSIBLE_KCAL) calories = null;
    caloriesSource = calories !== null ? 'estimate' : null;
  }

  try {
    return await sequelize.transaction(async (transaction) => {
      const recipe = await Recipe.create({
        source: dto.source,
        externalId: dto.externalId,
        title: dto.title.slice(0, 160),
        category: dto.category || null,
        area: dto.area || null,
        summary: dto.summary || null,
        instructions: dto.instructions || 'No instructions provided.',
        thumb: dto.thumb || null,
        youtube: dto.youtube || null,
        calories,
        caloriesSource,
        isVegetarian: diet.isVegetarian,
        isVegan: diet.isVegan,
        isGlutenFree: diet.isGlutenFree,
        tags: dto.tags || [],
      }, { transaction });

      await Ingredient.bulkCreate(dto.ingredients.map((i) => {
        const parsed = parseMeasure(i.measure);
        return {
          RecipeId: recipe.id,
          name: i.name.slice(0, 120),
          measure: i.measure ? i.measure.slice(0, 80) : null,
          quantity: parsed.quantity,
          unit: parsed.unit,
        };
      }), { transaction });
      return recipe;
    }).then((r) => Recipe.findByPk(r.id, withIngredients));
  } catch (err) {
    // Two requests saved the same recipe at once; the other one won.
    if (err instanceof UniqueConstraintError) {
      return Recipe.findOne({ where: { source: dto.source, externalId: dto.externalId }, ...withIngredients });
    }
    throw err;
  }
}

const { toSteps, formatRecipe } = require('./recipeFormat');

module.exports = { saveRecipe, formatRecipe, toSteps, withIngredients };
