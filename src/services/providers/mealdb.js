const { fetchJson } = require('../../utils/http');
const { cached } = require('../cache');

const BASE = 'https://www.themealdb.com/api/json/v1/1';

const clean = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '');

/** Convert a TheMealDB "meal" object into our recipe shape. */
function normalizeMeal(m) {
  const ingredients = [];
  for (let i = 1; i <= 20; i += 1) {
    const name = clean(m[`strIngredient${i}`]);
    if (name) ingredients.push({ name, measure: clean(m[`strMeasure${i}`]) });
  }
  return {
    source: 'mealdb',
    externalId: String(m.idMeal),
    title: clean(m.strMeal),
    category: clean(m.strCategory) || null,
    area: clean(m.strArea) || null,
    instructions: String(m.strInstructions || '').replace(/\r\n/g, '\n').trim(),
    thumb: clean(m.strMealThumb) || null,
    youtube: clean(m.strYoutube) || null,
    tags: clean(m.strTags).split(',').map(clean).filter(Boolean),
    servings: 4, // TheMealDB does not say; 4 is the usual size of its recipes
    ingredients,
  };
}

const get = (path) => cached(`mealdb:${path}`, () => fetchJson(`${BASE}/${path}`));

async function searchByName(query) {
  const json = await get(`search.php?s=${encodeURIComponent(query)}`);
  return (Array.isArray(json.meals) ? json.meals : []).map(normalizeMeal);
}

/** Recipes that contain ONE ingredient (the free API cannot combine several). */
async function filterByIngredient(ingredient) {
  const json = await get(`filter.php?i=${encodeURIComponent(ingredient.trim().replace(/\s+/g, '_'))}`);
  return Array.isArray(json.meals) ? json.meals : []; // [{ idMeal, strMeal, strMealThumb }]
}

async function filterByArea(area) {
  const json = await get(`filter.php?a=${encodeURIComponent(area)}`);
  return Array.isArray(json.meals) ? json.meals : [];
}

async function lookup(id) {
  const json = await get(`lookup.php?i=${encodeURIComponent(id)}`);
  return json.meals && json.meals[0] ? normalizeMeal(json.meals[0]) : null;
}

module.exports = { normalizeMeal, searchByName, filterByIngredient, filterByArea, lookup };
