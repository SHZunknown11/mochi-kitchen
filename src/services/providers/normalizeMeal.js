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

module.exports = { normalizeMeal };
