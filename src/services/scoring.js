const { containsTerm, ingredientMatches } = require('./diet');

/** Combine what the user ticked (explicit) with what the sentence said (parsed). Explicit wins. */
function mergePrefs(explicit = {}, parsed) {
  return {
    diet: explicit.diet && explicit.diet !== 'none' ? explicit.diet : parsed.diet.diet,
    glutenFree: Boolean(explicit.glutenFree || parsed.diet.glutenFree),
    maxCalories: explicit.maxCalories || parsed.maxCalories || null,
  };
}

/** How well does a stored recipe match the parsed request? Returns { score, matched }. */
function scoreRecipe(recipe, parsed) {
  const names = (recipe.Ingredients || []).map((i) => i.name);
  const title = recipe.title.toLowerCase();
  const matched = [];
  let score = 0;

  for (const ing of parsed.ingredients) {
    if (names.some((n) => ingredientMatches(n, ing))) { score += 3; matched.push(ing); }
    else if (containsTerm(title, [ing])) { score += 2; matched.push(ing); }
  }
  for (const k of [...parsed.other, ...parsed.mealTypes]) {
    if (title.includes(k)) { score += 4; matched.push(k); }
    else if ((recipe.category || '').toLowerCase() === k) { score += 2; matched.push(k); }
    else if ((recipe.tags || []).some((t) => t.toLowerCase().includes(k))) { score += 1; matched.push(k); }
  }
  for (const c of parsed.cuisines) {
    if ((recipe.area || '').toLowerCase().startsWith(c)) { score += 2; matched.push(c); }
  }
  for (const f of parsed.flavours) {
    const text = `${title} ${recipe.summary || ''} ${(recipe.tags || []).join(' ')}`.toLowerCase();
    if (text.includes(f)) { score += 1; matched.push(f); }
  }
  return { score, matched: [...new Set(matched)] };
}

module.exports = { mergePrefs, scoreRecipe };
