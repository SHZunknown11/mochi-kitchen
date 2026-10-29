function normalizeDrink(d) {
  const ingredients = [];
  for (let i = 1; i <= 15; i += 1) {
    const name = d[`strIngredient${i}`];
    if (name) ingredients.push({ name: String(name).trim(), measure: String(d[`strMeasure${i}`] || '').trim() });
  }
  return {
    id: String(d.idDrink),
    name: String(d.strDrink || '').trim(),
    thumb: d.strDrinkThumb || null,
    glass: d.strGlass || null,
    instructions: String(d.strInstructions || '').trim(),
    ingredients,
  };
}

module.exports = { normalizeDrink };
