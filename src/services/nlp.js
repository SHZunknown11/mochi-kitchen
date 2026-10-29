const natural = require('../utils/natural');
const { KNOWN_INGREDIENTS } = require('../data/ingredients');

const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;
const inflector = new natural.NounInflector();

// natural's list plus filler words that show up in "something like ..." style requests.
const STOP_WORDS = new Set([
  ...natural.stopwords,
  'something', 'anything', 'want', 'wanna', 'need', 'like', 'love', 'craving', 'looking', 'find', 'show',
  'give', 'make', 'cook', 'recipe', 'recipes', 'dish', 'dishes', 'meal', 'meals', 'please', 'good', 'nice',
  'tonight', 'today', 'easy', 'quick', 'simple', 'tasty', 'delicious', 'ideas', 'idea', 'using', 'use',
  'made', 'cooked', 'kind', 'sort', 'ive', 'got', 'have', 'fridge', 'home', 'under', 'calories', 'calorie',
  'cal', 'kcal', 'less', 'than', 'below', 'max', 'maximum', 'upto',
]);

const CUISINES = ['korean', 'japanese', 'italian', 'thai', 'indian', 'mexican', 'chinese', 'french', 'american',
  'greek', 'vietnamese', 'british', 'spanish', 'turkish', 'moroccan'];
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'dessert', 'snack', 'soup', 'salad', 'brunch', 'side', 'starter'];
const FLAVOURS = ['spicy', 'sweet', 'sour', 'savory', 'savoury', 'creamy', 'crispy', 'comfort', 'light', 'hearty', 'cheesy'];

const INGREDIENT_SET = new Set(KNOWN_INGREDIENTS);
const INGREDIENT_STEMS = new Map();
for (const ing of KNOWN_INGREDIENTS) {
  if (!ing.includes(' ')) INGREDIENT_STEMS.set(stemmer.stem(ing), ing);
}

function singular(word) {
  return /(ss|us)$/.test(word) ? word : inflector.singularize(word);
}

/**
 * Turn a free-text request into structured search hints.
 * "something vegan with tofu and rice under 500 calories" ->
 *   { ingredients: ['tofu','rice'], diet: { diet:'vegan' }, maxCalories: 500, ... }
 */
function extractKeywords(input) {
  const raw = String(input || '').slice(0, 300);
  let text = raw.toLowerCase().replace(/[’']/g, '');

  // 1. Dietary phrases (matched on the string so "gluten free" is one idea, not two words).
  const diet = { diet: 'none', glutenFree: false };
  if (/\bvegan\b/.test(text)) diet.diet = 'vegan';
  else if (/\b(vegetarian|veggie|meatless)\b/.test(text)) diet.diet = 'vegetarian';
  if (/\bgluten[\s-]?free\b/.test(text) || /\bcoeliac\b|\bceliac\b/.test(text)) diet.glutenFree = true;
  text = text.replace(/\bgluten[\s-]?free\b/g, ' ').replace(/\b(vegan|vegetarian|veggie|meatless)\b/g, ' ');

  // 2. Calorie limit: "under 500 calories", "less than 400 kcal", "max 600 cal".
  let maxCalories = null;
  const cal = text.match(/(?:under|below|less than|max(?:imum)?|up to|upto|<)\s*(\d{2,4})\s*(?:k?cal(?:ories)?)?/);
  if (cal) {
    maxCalories = Number(cal[1]);
    text = text.replace(cal[0], ' ');
  } else if (/\b(low[\s-]?cal(?:orie)?)\b/.test(text)) {
    maxCalories = 400;
    text = text.replace(/\blow[\s-]?cal(?:orie)?\b/g, ' ');
  }

  // 3. Tokens, with two-word ingredients ("soy sauce", "sweet potato") joined first.
  const joined = [...INGREDIENT_SET].filter((i) => i.includes(' ')).sort((a, b) => b.length - a.length);
  const phrases = [];
  for (const phrase of joined) {
    if (text.includes(phrase)) {
      phrases.push(phrase);
      text = text.replace(phrase, ' ');
    }
  }

  const tokens = tokenizer.tokenize(text) || [];
  const ingredients = [...phrases];
  const cuisines = [];
  const mealTypes = [];
  const flavours = [];
  const other = [];

  for (const token of tokens) {
    if (/^\d+$/.test(token)) continue;
    const word = singular(token);
    if (CUISINES.includes(word)) cuisines.push(word);
    else if (MEAL_TYPES.includes(word)) mealTypes.push(word);
    else if (FLAVOURS.includes(word)) flavours.push(word);
    else if (INGREDIENT_SET.has(word) || INGREDIENT_SET.has(token)) ingredients.push(word);
    else if (INGREDIENT_STEMS.has(stemmer.stem(word))) ingredients.push(INGREDIENT_STEMS.get(stemmer.stem(word)));
    else if (!STOP_WORDS.has(token) && !STOP_WORDS.has(word) && token.length > 2) other.push(word);
  }

  const uniq = (list) => [...new Set(list)];
  const result = {
    raw,
    ingredients: uniq(ingredients),
    cuisines: uniq(cuisines),
    mealTypes: uniq(mealTypes),
    flavours: uniq(flavours),
    other: uniq(other),
    diet,
    maxCalories,
  };
  result.keywords = uniq([
    ...result.ingredients, ...result.cuisines, ...result.mealTypes, ...result.flavours, ...result.other,
  ]);
  result.stems = result.keywords.map((k) => stemmer.stem(k));
  return result;
}

module.exports = { extractKeywords, STOP_WORDS };
