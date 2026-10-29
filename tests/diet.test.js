const { classifyIngredients, matchesPrefs, estimateCalories, containsTerm } = require('../src/services/diet');

describe('classifyIngredients', () => {
  test('plant-only recipe is vegan, vegetarian and gluten-free', () => {
    const r = classifyIngredients(['tofu', 'kimchi', 'rice', 'sesame oil']);
    expect(r).toMatchObject({ isVegetarian: true, isVegan: true, isGlutenFree: true });
  });

  test('meat makes a recipe non-vegetarian and non-vegan', () => {
    const r = classifyIngredients(['chicken thigh', 'rice']);
    expect(r).toMatchObject({ isVegetarian: false, isVegan: false, isGlutenFree: true });
  });

  test('fish and fish-based stock count as non-vegetarian', () => {
    expect(classifyIngredients(['dashi']).isVegetarian).toBe(false);
    expect(classifyIngredients(['fish sauce']).isVegetarian).toBe(false);
  });

  test('dairy, egg and honey make it vegetarian but not vegan', () => {
    for (const ing of ['butter', 'egg', 'honey', 'parmesan', 'mayonnaise']) {
      expect(classifyIngredients([ing])).toMatchObject({ isVegetarian: true, isVegan: false });
    }
  });

  test('substring traps are not false positives', () => {
    // "butter" in peanut butter, "milk" in coconut milk, "egg" in eggplant, "oyster" in oyster mushroom
    const r = classifyIngredients(['peanut butter', 'coconut milk', 'eggplant', 'oyster mushroom', 'butternut squash']);
    expect(r).toMatchObject({ isVegetarian: true, isVegan: true });
  });

  test('gluten sources are detected, gluten-free swaps are not', () => {
    expect(classifyIngredients(['soy sauce']).isGlutenFree).toBe(false);
    expect(classifyIngredients(['udon noodles']).isGlutenFree).toBe(false);
    expect(classifyIngredients(['panko breadcrumbs']).isGlutenFree).toBe(false);
    expect(classifyIngredients(['rice noodles', 'tamari', 'corn flour', 'rice flour']).isGlutenFree).toBe(true);
    expect(classifyIngredients(['gluten-free soy sauce']).isGlutenFree).toBe(true);
  });

  test('plurals match too', () => {
    expect(classifyIngredients(['prawns']).isVegetarian).toBe(false);
    expect(classifyIngredients(['eggs']).isVegan).toBe(false);
  });

  test('empty list is treated as plant-based (nothing to flag)', () => {
    expect(classifyIngredients([])).toMatchObject({ isVegetarian: true, isVegan: true, isGlutenFree: true });
  });
});

describe('containsTerm', () => {
  test('matches whole words only', () => {
    expect(containsTerm('ham', ['ham'])).toBe(true);
    expect(containsTerm('hamburger bun', ['ham'])).toBe(false);
    expect(containsTerm('cheesecake', ['cheese'])).toBe(false);
  });
});

describe('ingredientMatches', () => {
  const { ingredientMatches } = require('../src/services/diet');

  test('a base ingredient matches its variants', () => {
    expect(ingredientMatches('cooked rice', 'rice')).toBe(true);
    expect(ingredientMatches('chicken thigh', 'chicken')).toBe(true);
    expect(ingredientMatches('rice', 'rice')).toBe(true);
  });

  test('products made from it are different ingredients', () => {
    expect(ingredientMatches('rice vinegar', 'rice')).toBe(false);
    expect(ingredientMatches('sesame oil', 'sesame')).toBe(false);
    expect(ingredientMatches('chicken stock', 'chicken')).toBe(false);
  });

  test('but asking for the product itself works', () => {
    expect(ingredientMatches('rice vinegar', 'vinegar')).toBe(true);
    expect(ingredientMatches('rice vinegar', 'rice vinegar')).toBe(true);
    expect(ingredientMatches('soy sauce', 'soy sauce')).toBe(true);
  });

  test('unrelated names do not match', () => {
    expect(ingredientMatches('butternut squash', 'butter')).toBe(false);
    expect(ingredientMatches('tofu', 'rice')).toBe(false);
  });
});

describe('matchesPrefs', () => {
  const vegan = { isVegan: true, isVegetarian: true, isGlutenFree: true, calories: 400 };
  const chicken = { isVegan: false, isVegetarian: false, isGlutenFree: false, calories: 650 };
  const veg = { isVegan: false, isVegetarian: true, isGlutenFree: true, calories: null };

  test('no preferences lets everything through', () => {
    expect(matchesPrefs(chicken, {})).toBe(true);
    expect(matchesPrefs(chicken)).toBe(true);
    expect(matchesPrefs(chicken, { diet: 'none' })).toBe(true);
  });

  test('diet levels', () => {
    expect(matchesPrefs(vegan, { diet: 'vegan' })).toBe(true);
    expect(matchesPrefs(veg, { diet: 'vegan' })).toBe(false);
    expect(matchesPrefs(veg, { diet: 'vegetarian' })).toBe(true);
    expect(matchesPrefs(chicken, { diet: 'vegetarian' })).toBe(false);
  });

  test('gluten-free filter', () => {
    expect(matchesPrefs(chicken, { glutenFree: true })).toBe(false);
    expect(matchesPrefs(vegan, { glutenFree: true })).toBe(true);
  });

  test('calorie limit excludes higher and unknown calories', () => {
    expect(matchesPrefs(vegan, { maxCalories: 500 })).toBe(true);
    expect(matchesPrefs(chicken, { maxCalories: 500 })).toBe(false);
    expect(matchesPrefs(veg, { maxCalories: 500 })).toBe(false);
  });

  test('all conditions must hold together', () => {
    expect(matchesPrefs(vegan, { diet: 'vegan', glutenFree: true, maxCalories: 450 })).toBe(true);
    expect(matchesPrefs(vegan, { diet: 'vegan', glutenFree: true, maxCalories: 300 })).toBe(false);
  });
});

describe('estimateCalories', () => {
  test('sums known ingredients and divides by servings', () => {
    // rice 300 g -> 390, 2 eggs -> 143, 1 tbsp sesame oil -> ~133; total ~666 / 2 servings
    const kcal = estimateCalories(
      [{ name: 'rice', measure: '300g' }, { name: 'egg', measure: '2' }, { name: 'sesame oil', measure: '1 tbsp' }],
      2,
    );
    expect(kcal).toBeGreaterThan(300);
    expect(kcal).toBeLessThan(370);
    expect(kcal % 5).toBe(0);
  });

  test('returns null when no quantities can be read', () => {
    expect(estimateCalories([{ name: 'salt', measure: 'to taste' }])).toBeNull();
    expect(estimateCalories([])).toBeNull();
  });

  test('uses structured quantity/unit fields as well', () => {
    expect(estimateCalories([{ name: 'rice', quantity: 400, unit: 'g' }], 4)).toBe(130);
  });
});
