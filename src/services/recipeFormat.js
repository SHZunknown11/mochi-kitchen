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

module.exports = { toSteps, formatRecipe };
