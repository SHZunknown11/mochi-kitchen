const { parseMeasure, normalizeName, aggregate, aisleFor, formatAmount } = require('../src/services/grocery');

describe('parseMeasure', () => {
  test.each([
    ['200g', 200, 'g', 'mass'],
    ['1 1/2 cups', 1.5, 'cup', 'volume'],
    ['1/2 tsp', 0.5, 'tsp', 'volume'],
    ['400g/14oz', 400, 'g', 'mass'],
    ['2-3 tbsp', 2, 'tbsp', 'volume'],
    ['2 cloves', 2, 'clove', 'count'],
    ['1 lb', 1, 'lb', 'mass'],
  ])('%s', (text, quantity, unit, family) => {
    expect(parseMeasure(text)).toMatchObject({ quantity, unit, family });
  });

  test('converts to base units', () => {
    expect(parseMeasure('1 kg').base).toBe(1000);
    expect(parseMeasure('1 tbsp').base).toBe(15);
    expect(parseMeasure('2 cups').base).toBe(480);
  });

  test('a bare number is a count with no unit', () => {
    expect(parseMeasure('3')).toMatchObject({ quantity: 3, unit: null, family: 'count' });
    expect(parseMeasure('2 large')).toMatchObject({ quantity: 2, unit: null });
  });

  test('handles unicode fractions and bare pinch', () => {
    expect(parseMeasure('½ cup').quantity).toBe(0.5);
    expect(parseMeasure('pinch')).toMatchObject({ quantity: 1, unit: 'pinch' });
  });

  test('returns an empty measure for "to taste" and junk input', () => {
    expect(parseMeasure('to taste').quantity).toBeNull();
    expect(parseMeasure('').quantity).toBeNull();
    expect(parseMeasure(null).quantity).toBeNull();
    expect(parseMeasure(42).quantity).toBeNull();
  });
});

describe('normalizeName', () => {
  test('strips descriptors, brackets and trailing notes', () => {
    expect(normalizeName('Garlic cloves, minced').key).toBe('garlic');
    expect(normalizeName('Finely chopped onion (large)').display).toBe('onion');
  });

  test('singularises so plural and singular merge', () => {
    expect(normalizeName('Tomatoes').key).toBe('tomato');
    expect(normalizeName('tomato').key).toBe('tomato');
    expect(normalizeName('Chicken thighs').key).toBe(normalizeName('chicken thigh').key);
  });

  test('keeps cloves when it is the whole name (the spice)', () => {
    expect(normalizeName('cloves').display).toBe('cloves');
  });

  test('empty input gives an empty key', () => {
    expect(normalizeName('').key).toBe('');
    expect(normalizeName('(optional)').key).toBe('');
  });
});

describe('aggregate (grocery list)', () => {
  test('de-duplicates and sums matching units', () => {
    const list = aggregate([
      { name: 'Garlic cloves, minced', measure: '2 cloves' },
      { name: 'garlic', measure: '3 cloves' },
    ]);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: 'garlic', quantity: 5, unit: 'clove', amount: '5 cloves', lines: 2 });
  });

  test('adds across mass units: 500 g + 0.7 kg = 1.2 kg', () => {
    const [item] = aggregate([
      { name: 'Chicken thighs', measure: '500g' },
      { name: 'chicken thigh', measure: '0.7 kg' },
    ]);
    expect(item).toMatchObject({ quantity: 1.2, unit: 'kg', aisle: 'meat & seafood' });
  });

  test('adds across volume units: 2 tbsp + 1/4 cup = 90 ml', () => {
    const [item] = aggregate([
      { name: 'soy sauce', measure: '2 tbsp' },
      { name: 'Soy sauce', measure: '1/4 cup' },
    ]);
    expect(item).toMatchObject({ quantity: 90, unit: 'ml' });
  });

  test('small volumes are shown as teaspoons / tablespoons', () => {
    expect(aggregate([{ name: 'salt', measure: '1 tsp' }])[0]).toMatchObject({ quantity: 1, unit: 'tsp' });
    expect(aggregate([{ name: 'oil', measure: '2 tbsp' }])[0]).toMatchObject({ quantity: 2, unit: 'tbsp' });
  });

  test('cups of dry or solid foods become grams and merge with weighed amounts', () => {
    // 1 cup flour = 240 ml x 0.52 g/ml = 124.8 g -> 125 g, plus 100 g = 225 g
    const [flour] = aggregate([{ name: 'flour', measure: '1 cup' }, { name: 'Flour', measure: '100g' }]);
    expect(flour).toMatchObject({ unit: 'g', quantity: 225 });
    const list = aggregate([{ name: 'kimchi', measure: '300 g' }, { name: 'kimchi', measure: '1 cup' }]);
    expect(list).toHaveLength(1);
    expect(list[0].unit).toBe('g');
  });

  test('liquids with no density stay in volume', () => {
    expect(aggregate([{ name: 'soy sauce', measure: '1 cup' }])[0]).toMatchObject({ unit: 'ml', quantity: 240 });
  });

  test('spoon amounts are rounded to quarters so they read like a recipe', () => {
    // 1 + 1 + 1/3 tbsp = 35 ml = 2.33 tbsp, shown as 2.25
    expect(aggregate([{ name: 'oil', measure: '1 tbsp' }, { name: 'oil', measure: '1 tbsp' }, { name: 'oil', measure: '1/3 tbsp' }])[0])
      .toMatchObject({ unit: 'tbsp', quantity: 2.25 });
    // 3 x 1/2 tsp = 1.5 tsp
    expect(aggregate([1, 2, 3].map(() => ({ name: 'salt', measure: '1/2 tsp' })))[0]).toMatchObject({ unit: 'tsp', quantity: 1.5 });
  });

  test('"to taste" folds into an existing row instead of adding a duplicate', () => {
    const list = aggregate([
      { name: 'Salt', measure: 'to taste' },
      { name: 'salt', measure: '1 tsp' },
    ]);
    expect(list).toHaveLength(1);
    expect(list[0].lines).toBe(2);
  });

  test('"to taste" alone stays as a row with no amount', () => {
    const [item] = aggregate([{ name: 'black pepper', measure: 'to taste' }]);
    expect(item).toMatchObject({ quantity: null, amount: '' });
  });

  test('different unit families stay separate rows', () => {
    const list = aggregate([
      { name: 'butter', measure: '50g' },
      { name: 'butter', measure: '2 tbsp' },
    ]);
    expect(list).toHaveLength(2);
  });

  test('accepts quantity/unit fields as well as measure text', () => {
    const [item] = aggregate([
      { name: 'rice', quantity: 200, unit: 'g' },
      { name: 'rice', quantity: 300, unit: 'g' },
    ]);
    expect(item).toMatchObject({ quantity: 500, unit: 'g' });
  });

  test('sorts by aisle then name and skips blank names', () => {
    const list = aggregate([
      { name: 'rice', measure: '1 cup' },
      { name: '', measure: '1' },
      { name: 'carrot', measure: '2' },
      { name: 'milk', measure: '1 cup' },
    ]);
    expect(list.map((i) => i.aisle)).toEqual(['dairy & eggs', 'grains & noodles', 'produce']);
  });

  test('empty input gives an empty list', () => {
    expect(aggregate([])).toEqual([]);
  });
});

describe('helpers', () => {
  test('aisleFor falls back to pantry', () => {
    expect(aisleFor('soy sauce')).toBe('pantry');
    expect(aisleFor('garlic')).toBe('produce');
  });

  test('formatAmount pluralises count units', () => {
    expect(formatAmount(1, 'clove')).toBe('1 clove');
    expect(formatAmount(2, 'bunch')).toBe('2 bunches');
    expect(formatAmount(null, 'g')).toBe('');
  });
});
