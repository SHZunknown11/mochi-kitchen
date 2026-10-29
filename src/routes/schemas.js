const Joi = require('joi');

const dietPrefs = Joi.object({
  diet: Joi.string().valid('none', 'vegetarian', 'vegan').default('none'),
  glutenFree: Joi.boolean().default(false),
  maxCalories: Joi.number().integer().min(100).max(3000).allow(null).default(null),
});

const id = Joi.number().integer().min(1);

module.exports = {
  register: Joi.object({
    username: Joi.string().pattern(/^[A-Za-z0-9_]+$/).min(3).max(30).required()
      .messages({ 'string.pattern.base': 'Username can only use letters, numbers and underscores.' }),
    email: Joi.string().email().max(120).required(),
    password: Joi.string().min(8).max(72).pattern(/[A-Za-z]/).pattern(/\d/).required()
      .messages({ 'string.pattern.base': 'Password needs at least one letter and one number.' }),
  }),
  login: Joi.object({
    identifier: Joi.string().min(3).max(120).required(),
    password: Joi.string().min(1).max(72).required(),
  }),
  refresh: Joi.object({ refreshToken: Joi.string().hex().length(96).required() }),
  profile: Joi.object({ dietPrefs: dietPrefs.required() }),

  search: Joi.object({
    mode: Joi.string().valid('text', 'ingredients', 'diet').default('text'),
    query: Joi.string().trim().max(200).allow('').default(''),
    ingredients: Joi.array().items(Joi.string().trim().min(2).max(40)).max(10).default([]),
    provider: Joi.string().valid('free', 'ai').default('free'),
    diet: dietPrefs.optional(),
  }),
  idParam: Joi.object({ id: id.required() }),
  recipeIdParam: Joi.object({ recipeId: id.required() }),
  favouriteAdd: Joi.object({ recipeId: id.required() }),

  groceryCreate: Joi.object({
    recipeIds: Joi.array().items(id).min(1).max(21).unique().required(),
    name: Joi.string().trim().min(1).max(80).default('My shopping list'),
  }),
  groceryItem: Joi.object({ id: id.required(), itemId: id.required() }),
  groceryItemPatch: Joi.object({ checked: Joi.boolean().required() }),

  pantryAdd: Joi.object({ name: Joi.string().trim().min(2).max(60).required() }),
  mealPlan: Joi.object({
    days: Joi.number().integer().min(3).max(7).default(7),
    provider: Joi.string().valid('free', 'ai').default('free'),
    usePantry: Joi.boolean().default(false),
  }),
};
