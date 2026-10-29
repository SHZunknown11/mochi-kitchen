// TheMealDB / TheCocktailDB with a D1-backed cache (same behaviour as src/services/providers).
const { fetchJson } = require('../../src/utils/http');
const { normalizeMeal } = require('../../src/services/providers/normalizeMeal');
const { normalizeDrink } = require('../../src/services/providers/normalizeDrink');
const data = require('./data');

const DAY = 24 * 60 * 60 * 1000;
const MEAL = 'https://www.themealdb.com/api/json/v1/1';
const DRINK = 'https://www.thecocktaildb.com/api/json/v1/1';

function mealdb(db) {
  const get = (path) => data.cached(db, `mealdb:${path}`, () => fetchJson(`${MEAL}/${path}`), DAY);
  const list = (json) => (Array.isArray(json.meals) ? json.meals : []);
  return {
    async searchByName(q) { return list(await get(`search.php?s=${encodeURIComponent(q)}`)).map(normalizeMeal); },
    async filterByIngredient(i) { return list(await get(`filter.php?i=${encodeURIComponent(i.trim().replace(/\s+/g, '_'))}`)); },
    async filterByArea(a) { return list(await get(`filter.php?a=${encodeURIComponent(a)}`)); },
    async lookup(id) { const j = await get(`lookup.php?i=${encodeURIComponent(id)}`); return j.meals && j.meals[0] ? normalizeMeal(j.meals[0]) : null; },
  };
}

async function pairingFor(db, seed) {
  const json = await data.cached(db, 'cocktaildb:non-alcoholic', () => fetchJson(`${DRINK}/filter.php?a=Non_Alcoholic`), DAY);
  const drinks = json.drinks || [];
  if (drinks.length === 0) return null;
  const n = [...String(seed)].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const id = drinks[n % drinks.length].idDrink;
  const one = await data.cached(db, `cocktaildb:lookup:${id}`, () => fetchJson(`${DRINK}/lookup.php?i=${encodeURIComponent(id)}`), DAY);
  return one.drinks && one.drinks[0] ? normalizeDrink(one.drinks[0]) : null;
}

module.exports = { mealdb, pairingFor };
