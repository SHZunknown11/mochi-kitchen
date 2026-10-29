const express = require('express');
const { PantryItem } = require('../models');
const { normalizeName } = require('../services/grocery');
const { matchPantry } = require('../services/pantry');
const mealplan = require('../services/mealplan');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimit');
const { AppError } = require('../middleware/error');
const schemas = require('./schemas');

const router = express.Router();

// ---- Pantry --------------------------------------------------------------
router.get('/pantry', requireAuth, async (req, res) => {
  const items = await PantryItem.findAll({ where: { UserId: req.user.id }, order: [['name', 'ASC']] });
  res.json({ items: items.map((i) => ({ id: i.id, name: i.name })) });
});

router.post('/pantry', requireAuth, validate(schemas.pantryAdd), async (req, res) => {
  const { display } = normalizeName(req.valid.body.name);
  if (!display) throw new AppError(400, 'Please type an ingredient name.');
  const [item, created] = await PantryItem.findOrCreate({ where: { UserId: req.user.id, name: display } });
  res.status(created ? 201 : 200).json({ item: { id: item.id, name: item.name } });
});

// Registered before "/pantry/:id" so "match" is not read as an id.
router.get('/pantry/match', requireAuth, async (req, res) => {
  res.json({ recipes: await matchPantry(req.user.id, req.user.dietPrefs) });
});

router.delete('/pantry/:id', requireAuth, validate(schemas.idParam, 'params'), async (req, res) => {
  await PantryItem.destroy({ where: { id: req.valid.params.id, UserId: req.user.id } });
  res.status(204).end();
});

// ---- Meal planner --------------------------------------------------------
const limitAi = (req, res, next) => (req.valid.body.provider === 'ai' ? aiLimiter(req, res, next) : next());

router.post('/mealplan', requireAuth, validate(schemas.mealPlan), limitAi, async (req, res) => {
  const { days, provider, usePantry } = req.valid.body;
  const pantryNames = usePantry
    ? (await PantryItem.findAll({ where: { UserId: req.user.id } })).map((p) => normalizeName(p.name).key)
    : [];
  res.status(201).json(await mealplan.generatePlan({ user: req.user, days, provider, pantryNames }));
});

router.get('/mealplan', requireAuth, async (req, res) => {
  res.json({ plan: await mealplan.latestPlan(req.user) });
});

module.exports = router;
