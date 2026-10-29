const {
  MEAT, FISH, FISH_EXCEPTIONS, DAIRY, DAIRY_EXCEPTIONS, EGG, EGG_EXCEPTIONS, HONEY, GLUTEN, GLUTEN_EXCEPTIONS,
} = require('../data/ingredients');
const {
  KCAL_PER_100G, GRAMS_PER_PIECE, DENSITY_G_PER_ML, DEFAULT_KCAL_PER_100G, DEFAULT_GRAMS_PER_PIECE,
} = require('../data/kcal');
const { parseMeasure, normalizeName } = require('./grocery');

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** True if `text` contains one of `terms` as a whole word/phrase, after removing `exceptions`. */
function containsTerm(text, terms, exceptions = []) {
  let s = ` ${String(text).toLowerCase()} `;
  for (const ex of exceptions) s = s.split(ex).join(' ');
  return terms.some((t) => new RegExp(`(?:^|[^a-z])${escapeRe(t)}(?:s|es)?(?:$|[^a-z])`).test(s));
}

// Last words that turn an ingredient into something else: "rice vinegar" is not rice.
const PRODUCT_WORDS = new Set(['vinegar', 'sauce', 'oil', 'paste', 'stock', 'broth', 'powder', 'flour', 'starch', 'syrup', 'seeds']);

/** Does the ingredient line `name` count as the wanted ingredient `term`? ("rice" matches "cooked rice", not "rice vinegar") */
function ingredientMatches(name, term) {
  if (!containsTerm(name, [term])) return false;
  const words = String(name).toLowerCase().trim().split(/\s+/);
  const last = words[words.length - 1];
  return !(PRODUCT_WORDS.has(last) && !term.split(' ').includes(last));
}

/**
 * Classify a list of ingredient names. This is name-based, so it is a helpful guide and not a
 * guarantee (hidden ingredients in sauces can't be seen) - the UI says so.
 */
function classifyIngredients(names) {
  const flags = { meat: false, fish: false, dairy: false, egg: false, honey: false, gluten: false };
  for (const name of names) {
    if (containsTerm(name, MEAT)) flags.meat = true;
    if (containsTerm(name, FISH, FISH_EXCEPTIONS)) flags.fish = true;
    if (containsTerm(name, DAIRY, DAIRY_EXCEPTIONS)) flags.dairy = true;
    if (containsTerm(name, EGG, EGG_EXCEPTIONS)) flags.egg = true;
    if (containsTerm(name, HONEY)) flags.honey = true;
    if (!/gluten[- ]free/i.test(name) && containsTerm(name, GLUTEN, GLUTEN_EXCEPTIONS)) flags.gluten = true;
  }
  const isVegetarian = !flags.meat && !flags.fish;
  return {
    isVegetarian,
    isVegan: isVegetarian && !flags.dairy && !flags.egg && !flags.honey,
    isGlutenFree: !flags.gluten,
    flags,
  };
}

/** Does a stored recipe satisfy a user's dietary preferences? */
function matchesPrefs(recipe, prefs = {}) {
  if (prefs.diet === 'vegan' && !recipe.isVegan) return false;
  if (prefs.diet === 'vegetarian' && !recipe.isVegetarian) return false;
  if (prefs.glutenFree && !recipe.isGlutenFree) return false;
  if (prefs.maxCalories) {
    // Unknown calories cannot be shown to satisfy a limit, so they do not pass.
    if (recipe.calories === null || recipe.calories === undefined) return false;
    if (recipe.calories > prefs.maxCalories) return false;
  }
  return true;
}

function lookupKcal(key) {
  if (KCAL_PER_100G[key] !== undefined) return { key, kcal: KCAL_PER_100G[key] };
  // The last word names the thing ("chicken stock" is a stock, not a chicken), so prefer a match
  // that ends the name; otherwise take the longest phrase found inside it.
  const matches = Object.keys(KCAL_PER_100G).filter((k) => new RegExp(`(?:^|\\s)${escapeRe(k)}(?:$|\\s)`).test(key));
  const endsWith = matches.filter((k) => key.endsWith(k));
  const pool = endsWith.length > 0 ? endsWith : matches;
  const best = pool.sort((a, b) => b.length - a.length)[0] || null;
  return best ? { key: best, kcal: KCAL_PER_100G[best] } : { key, kcal: DEFAULT_KCAL_PER_100G };
}

/** Rough per-serving calories from the ingredient list. Returns an integer or null. */
function estimateCalories(ingredients, servings = 4) {
  let total = 0;
  let counted = 0;
  for (const ing of ingredients) {
    const { key } = normalizeName(ing.name);
    if (!key) continue;
    const parsed = ing.measure !== undefined
      ? parseMeasure(ing.measure)
      : parseMeasure(`${ing.quantity ?? ''} ${ing.unit ?? ''}`.trim());
    if (parsed.quantity === null) continue;

    const { key: hit, kcal } = lookupKcal(key);
    let grams;
    if (parsed.family === 'mass') grams = parsed.base;
    else if (parsed.family === 'volume') grams = parsed.base * (DENSITY_G_PER_ML[hit] ?? DENSITY_G_PER_ML[key] ?? 1);
    else grams = parsed.quantity * (GRAMS_PER_PIECE[hit] || DEFAULT_GRAMS_PER_PIECE);
    total += (grams * kcal) / 100;
    counted += 1;
  }
  if (counted === 0) return null;
  const perServing = total / Math.max(1, servings);
  return Math.max(50, Math.round(perServing / 5) * 5);
}

module.exports = { classifyIngredients, matchesPrefs, estimateCalories, containsTerm, ingredientMatches };
