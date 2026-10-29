const { fetchJson } = require('../../utils/http');
const { cached } = require('../cache');

const BASE = 'https://www.themealdb.com/api/json/v1/1';

const { normalizeMeal } = require('./normalizeMeal');

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
