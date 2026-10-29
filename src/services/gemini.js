const crypto = require('crypto');
const Joi = require('joi');
const { GoogleGenAI } = require('@google/genai');
const config = require('../config');

class AiUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AiUnavailableError';
  }
}

let client = null;
function getClient() {
  if (!config.gemini.apiKey) throw new AiUnavailableError('No Gemini API key configured');
  if (!client) client = new GoogleGenAI({ apiKey: config.gemini.apiKey });
  return client;
}
/** Test hook: inject a fake client. */
function setClient(fake) {
  client = fake;
}
const isConfigured = () => Boolean(config.gemini.apiKey) || client !== null;

/** Keep only harmless words, so user text can never smuggle instructions into a prompt. */
function safeTerms(list, max = 12) {
  return (Array.isArray(list) ? list : [])
    .map((t) => String(t).toLowerCase().replace(/[^a-z0-9 -]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, max);
}

async function generateJson(prompt) {
  const ai = getClient();
  let timer;
  try {
    const response = await Promise.race([
      ai.models.generateContent({
        model: config.gemini.model,
        contents: prompt,
        config: { responseMimeType: 'application/json', temperature: 0.8 },
      }),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), config.gemini.timeoutMs);
      }),
    ]);
    const text = String(response.text || '').replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    return JSON.parse(text);
  } catch (err) {
    throw new AiUnavailableError(err instanceof SyntaxError ? 'Gemini returned unreadable JSON' : 'Gemini request failed');
  } finally {
    clearTimeout(timer);
  }
}

const recipeSchema = Joi.object({
  title: Joi.string().min(2).max(120).required(),
  category: Joi.string().max(60).allow('', null),
  area: Joi.string().max(60).allow('', null),
  summary: Joi.string().max(300).allow('', null),
  servings: Joi.number().integer().min(1).max(20).default(2),
  calories: Joi.number().integer().min(20).max(3000).allow(null),
  ingredients: Joi.array().items(Joi.object({
    name: Joi.string().min(1).max(80).required(),
    measure: Joi.string().max(60).allow('', null).default(''),
  })).min(1).max(30).required(),
  steps: Joi.array().items(Joi.string().min(2).max(500)).min(1).max(15).required(),
}).unknown(true);

const stripTags = (s) => String(s || '').replace(/<[^>]*>/g, '').trim();

/**
 * Ask Gemini for recipe ideas. Only NLP-extracted keywords are sent (never the raw query),
 * which keeps the prompt tight and removes any chance of prompt injection through user text.
 */
async function suggestRecipes({ ingredients = [], cuisines = [], flavours = [], mealTypes = [], other = [], diet = {}, maxCalories = null, count = 4 }) {
  const dietLine = [
    diet.diet && diet.diet !== 'none' ? `strictly ${diet.diet}` : null,
    diet.glutenFree ? 'gluten-free' : null,
    maxCalories ? `at most ${Number(maxCalories)} kcal per serving` : null,
  ].filter(Boolean).join(', ') || 'no restrictions';

  const prompt = [
    'You are the recipe helper inside a cute cooking app. Suggest realistic recipes a home cook can make.',
    `Ingredients to use: ${safeTerms(ingredients).join(', ') || 'any'}.`,
    `Cuisine: ${safeTerms(cuisines).join(', ') || 'any'}. Meal: ${safeTerms(mealTypes).join(', ') || 'any'}.`,
    `Mood/flavour: ${safeTerms([...flavours, ...other]).join(', ') || 'any'}.`,
    `Dietary rules: ${dietLine}.`,
    `Return a JSON array of exactly ${Math.min(Math.max(count, 1), 6)} distinct recipes. Each item has:`,
    '{"title": string, "category": string, "area": string, "summary": string (max 160 chars), "servings": integer,',
    ' "calories": integer (estimated kcal per serving), "ingredients": [{"name": string, "measure": string}],',
    ' "steps": [string]}. Use plain text only. Respect the dietary rules exactly.',
  ].join('\n');

  const raw = await generateJson(prompt);
  const list = Array.isArray(raw) ? raw : raw && Array.isArray(raw.recipes) ? raw.recipes : [];
  const recipes = [];
  for (const item of list) {
    const { value, error } = recipeSchema.validate(item, { stripUnknown: true });
    if (error) continue;
    recipes.push({
      source: 'gemini',
      externalId: crypto.createHash('sha1').update(value.title.toLowerCase()).digest('hex').slice(0, 16),
      title: stripTags(value.title),
      category: stripTags(value.category) || null,
      area: stripTags(value.area) || null,
      summary: stripTags(value.summary) || null,
      servings: value.servings,
      calories: value.calories ?? null,
      instructions: value.steps.map(stripTags).join('\n'),
      tags: ['ai'],
      ingredients: value.ingredients.map((i) => ({ name: stripTags(i.name), measure: stripTags(i.measure) })),
    });
  }
  if (recipes.length === 0) throw new AiUnavailableError('Gemini returned no usable recipes');
  return recipes;
}

const planSchema = Joi.array().items(Joi.object({
  day: Joi.number().integer().min(1).max(14).required(),
  lunch: Joi.number().integer().required(),
  dinner: Joi.number().integer().required(),
  note: Joi.string().max(200).allow('', null),
})).min(1);

/**
 * Ask Gemini to arrange REAL stored recipes into a plan. It may only answer with ids from
 * `candidates`; anything else is rejected so the plan never points at a recipe that doesn't exist.
 */
async function planMeals({ candidates, days, prefs, pantry = [] }) {
  const prompt = [
    'You are a friendly meal-planning helper. Build a varied plan for the days below.',
    `Days: ${days}. Dietary profile: ${[prefs.diet !== 'none' ? prefs.diet : null, prefs.glutenFree ? 'gluten-free' : null,
      prefs.maxCalories ? `max ${prefs.maxCalories} kcal` : null].filter(Boolean).join(', ') || 'none'}.`,
    pantry.length ? `Ingredients the cook already has (prefer them): ${safeTerms(pantry, 25).join(', ')}.` : '',
    'Choose lunch and dinner for each day ONLY from these recipes (id: title [category]):',
    candidates.map((c) => `${c.id}: ${safeTerms([c.title], 1)[0] || c.title} [${c.category || 'misc'}]`).join('\n'),
    'Avoid repeating a recipe unless there are too few. Return a JSON array:',
    '[{"day": 1, "lunch": <id>, "dinner": <id>, "note": "one short cheerful sentence"}]',
  ].filter(Boolean).join('\n');

  const raw = await generateJson(prompt);
  const { value, error } = planSchema.validate(raw, { stripUnknown: true });
  if (error) throw new AiUnavailableError('Gemini plan was not in the expected shape');
  const known = new Set(candidates.map((c) => c.id));
  if (value.some((d) => !known.has(d.lunch) || !known.has(d.dinner))) {
    throw new AiUnavailableError('Gemini plan used unknown recipes');
  }
  return value.slice(0, days).map((d) => ({ ...d, note: stripTags(d.note) }));
}

module.exports = { AiUnavailableError, isConfigured, setClient, suggestRecipes, planMeals, safeTerms };
