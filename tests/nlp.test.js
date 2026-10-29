const { extractKeywords } = require('../src/services/nlp');

describe('extractKeywords', () => {
  test('pulls ingredients, flavour and a diet out of a sentence', () => {
    const r = extractKeywords('Something spicy and vegan with tofu, kimchi and rice');
    expect(r.ingredients).toEqual(expect.arrayContaining(['tofu', 'kimchi', 'rice']));
    expect(r.flavours).toContain('spicy');
    expect(r.diet.diet).toBe('vegan');
  });

  test('drops stop words and filler', () => {
    const r = extractKeywords('I would like something with the chicken please');
    expect(r.keywords).toEqual(['chicken']);
  });

  test('joins two-word ingredients and singularises plurals', () => {
    const r = extractKeywords('sweet potatoes and soy sauce');
    expect(r.ingredients).toEqual(expect.arrayContaining(['sweet potato', 'soy sauce']));
    expect(r.ingredients).not.toContain('sweet');
  });

  test('detects cuisine and meal type', () => {
    const r = extractKeywords('a japanese dinner');
    expect(r.cuisines).toEqual(['japanese']);
    expect(r.mealTypes).toEqual(['dinner']);
  });

  test('detects gluten-free in several spellings', () => {
    expect(extractKeywords('gluten free pasta').diet.glutenFree).toBe(true);
    expect(extractKeywords('gluten-free pasta').diet.glutenFree).toBe(true);
    expect(extractKeywords('pasta').diet.glutenFree).toBe(false);
  });

  test('detects vegetarian wording', () => {
    expect(extractKeywords('veggie ramen').diet.diet).toBe('vegetarian');
    expect(extractKeywords('meatless dinner').diet.diet).toBe('vegetarian');
  });

  test('"vegan" wins over "vegetarian" when both appear', () => {
    expect(extractKeywords('vegan or vegetarian').diet.diet).toBe('vegan');
  });

  test('reads calorie limits', () => {
    expect(extractKeywords('dinner under 500 calories').maxCalories).toBe(500);
    expect(extractKeywords('less than 350 kcal rice bowl').maxCalories).toBe(350);
    expect(extractKeywords('max 600 cal').maxCalories).toBe(600);
    expect(extractKeywords('low calorie lunch').maxCalories).toBe(400);
    expect(extractKeywords('rice bowl').maxCalories).toBeNull();
  });

  test('the calorie number is not treated as a keyword', () => {
    const r = extractKeywords('chicken under 500 calories');
    expect(r.keywords).toEqual(['chicken']);
  });

  test('unknown content words are kept as generic keywords', () => {
    const r = extractKeywords('bibimbap');
    expect(r.other).toEqual(['bibimbap']);
    expect(r.keywords).toEqual(['bibimbap']);
  });

  test('keywords are unique and stems line up with keywords', () => {
    const r = extractKeywords('rice rice RICE and chicken');
    expect(r.keywords).toEqual(['rice', 'chicken']);
    expect(r.stems).toHaveLength(r.keywords.length);
  });

  test('is safe with empty, non-string and very long input', () => {
    expect(extractKeywords('').keywords).toEqual([]);
    expect(extractKeywords(null).keywords).toEqual([]);
    expect(extractKeywords(undefined).raw).toBe('');
    expect(extractKeywords('a'.repeat(5000)).raw).toHaveLength(300);
  });
});
