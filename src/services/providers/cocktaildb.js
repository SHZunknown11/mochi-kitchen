const { fetchJson } = require('../../utils/http');
const { cached } = require('../cache');

const BASE = 'https://www.thecocktaildb.com/api/json/v1/1';

const { normalizeDrink } = require('./normalizeDrink');

async function nonAlcoholicList() {
  const json = await cached('cocktaildb:non-alcoholic', () => fetchJson(`${BASE}/filter.php?a=Non_Alcoholic`));
  return json.drinks || [];
}

async function lookup(id) {
  const json = await cached(`cocktaildb:lookup:${id}`, () => fetchJson(`${BASE}/lookup.php?i=${encodeURIComponent(id)}`));
  return json.drinks && json.drinks[0] ? normalizeDrink(json.drinks[0]) : null;
}

/**
 * A drink to go with a recipe. We always suggest non-alcoholic drinks, and pick one
 * deterministically from the recipe id so the same recipe always shows the same pairing.
 */
async function pairingFor(seed) {
  const list = await nonAlcoholicList();
  if (list.length === 0) return null;
  const n = [...String(seed)].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return lookup(list[n % list.length].idDrink);
}

module.exports = { normalizeDrink, nonAlcoholicList, lookup, pairingFor };
