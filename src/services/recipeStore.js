const { UniqueConstraintError } = require('sequelize');
const { sequelize, Recipe, Ingredient } = require('../models');
const { classifyIngredients, estimateCalories } = require('./diet');
const { parseMeasure } = require('./grocery');

const withIngredients = { include: [{ model: Ingredient, order: [['id', 'ASC']] }], order: [[Ingredient, 'id', 'ASC']] };

/**
 * Save a recipe from any source (seed / TheMealDB / Gemini). Diet flags are always computed by
 * our own classifier so every source is judged the same way. If the recipe already exists
 * (same source + externalId) the stored copy is returned unchanged.
 */
async function saveRecipe(dto) {
  const existing = await Recipe.findOne({ where: { source: dto.source, externalId: dto.externalId }, ...withIngredients });
  if (existing) return existing;

  const diet = classifyIngredients(dto.ingredients.map((i) => i.name));
  let calories = Number.isFinite(dto.calories) ? Math.round(dto.calories) : null;
  let caloriesSource = calories !== null ? 'ai' : null;
  if (calories === null) {
    calories = estimateCalories(dto.ingredients, dto.servings || 4);
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

/** Split stored instructions into steps ("STEP 1" headings and blank lines removed). */
function toSteps(instructions) {
  return String(instructions || '')
    .split(/\r?\n+/)
    .map((l) => l.replace(/^\s*(?:step\s*\d+[:.)-]?|\d+[.)])\s*/i, '').trim())
    .filter((l) => l && !/^step\s*\d*$/i.test(l));
}

/** Shape a Recipe row for the API. */
function formatRecipe(recipe) {
  const r = recipe.toJSON ? recipe.toJSON() : recipe;
  return {
    id: r.id,
    source: r.source,
    title: r.title,
    category: r.category,
    area: r.area,
    summary: r.summary,
    steps: toSteps(r.instructions),
    thumb: r.thumb,
    youtube: r.youtube,
    calories: r.calories,
    caloriesNote: r.caloriesSource === 'ai' ? 'AI estimate' : r.caloriesSource === 'estimate' ? 'approx.' : null,
    diet: { vegetarian: r.isVegetarian, vegan: r.isVegan, glutenFree: r.isGlutenFree },
    tags: r.tags,
    ingredients: (r.Ingredients || []).map((i) => ({ name: i.name, measure: i.measure })),
  };
}

module.exports = { saveRecipe, formatRecipe, toSteps, withIngredients };
