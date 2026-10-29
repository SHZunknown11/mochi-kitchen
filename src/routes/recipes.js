const express = require('express');
const { Recipe, Favourite } = require('../models');
const { search } = require('../services/search');
const { formatRecipe, withIngredients } = require('../services/recipeStore');
const cocktaildb = require('../services/providers/cocktaildb');
const gemini = require('../services/gemini');
const { validate } = require('../middleware/validate');
const { optionalAuth } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimit');
const { AppError } = require('../middleware/error');
const schemas = require('./schemas');

const router = express.Router();

// Only AI searches count against the tighter AI limit.
const limitAi = (req, res, next) => (req.valid.body.provider === 'ai' ? aiLimiter(req, res, next) : next());

router.post('/search', optionalAuth, validate(schemas.search), limitAi, async (req, res) => {
  const body = { ...req.valid.body };
  // Logged-in users get their saved dietary profile unless the page sent explicit filters.
  if (!body.diet && req.user) body.diet = req.user.dietPrefs;
  const result = await search(body);

  if (req.user && result.results.length > 0) {
    const favs = await Favourite.findAll({
      where: { UserId: req.user.id, RecipeId: result.results.map((r) => r.id) },
      attributes: ['RecipeId'],
    });
    const ids = new Set(favs.map((f) => f.RecipeId));
    result.results.forEach((r) => { r.isFavourite = ids.has(r.id); });
  }
  res.json(result);
});

router.get('/recipes/:id', optionalAuth, validate(schemas.idParam, 'params'), async (req, res) => {
  const recipe = await Recipe.findByPk(req.valid.params.id, withIngredients);
  if (!recipe) throw new AppError(404, 'We could not find that recipe.');
  const out = formatRecipe(recipe);
  if (req.user) {
    out.isFavourite = Boolean(await Favourite.findOne({ where: { UserId: req.user.id, RecipeId: recipe.id } }));
  }
  res.json(out);
});

// A non-alcoholic drink to go with the dish (TheCocktailDB). Never fails the page: null if the service is down.
router.get('/recipes/:id/pairing', validate(schemas.idParam, 'params'), async (req, res) => {
  const recipe = await Recipe.findByPk(req.valid.params.id, { attributes: ['id'] });
  if (!recipe) throw new AppError(404, 'We could not find that recipe.');
  let drink = null;
  try {
    drink = await cocktaildb.pairingFor(recipe.id);
  } catch {
    drink = null;
  }
  res.json({ drink });
});

router.get('/ai/status', (req, res) => {
  res.json({ configured: gemini.isConfigured() });
});

module.exports = router;
