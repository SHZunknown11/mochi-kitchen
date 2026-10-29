const express = require('express');
const { Recipe, Ingredient, GroceryList, GroceryItem } = require('../models');
const { aggregate } = require('../services/grocery');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { AppError } = require('../middleware/error');
const schemas = require('./schemas');

const router = express.Router();
router.use(requireAuth);

const itemJson = (i) => ({
  id: i.id,
  name: i.name,
  quantity: i.quantity,
  unit: i.unit,
  aisle: i.aisle,
  checked: i.checked,
});

const listJson = (list) => ({
  id: list.id,
  name: list.name,
  recipeIds: list.recipeIds,
  createdAt: list.createdAt,
  items: (list.GroceryItems || []).map(itemJson),
});

async function findOwnedList(req) {
  const list = await GroceryList.findOne({
    where: { id: req.valid.params.id, UserId: req.user.id },
    include: [GroceryItem],
    order: [[GroceryItem, 'id', 'ASC']],
  });
  if (!list) throw new AppError(404, 'We could not find that shopping list.');
  return list;
}

// Build a de-duplicated shopping list from the chosen recipes.
router.post('/', validate(schemas.groceryCreate), async (req, res) => {
  const { recipeIds, name } = req.valid.body;
  const recipes = await Recipe.findAll({ where: { id: recipeIds }, include: [Ingredient] });
  if (recipes.length !== recipeIds.length) throw new AppError(404, 'One of those recipes no longer exists.');

  const lines = recipes.flatMap((r) => r.Ingredients.map((i) => ({ name: i.name, measure: i.measure || '' })));
  const merged = aggregate(lines);

  const list = await GroceryList.create({ UserId: req.user.id, name, recipeIds });
  await GroceryItem.bulkCreate(merged.map((m) => ({
    GroceryListId: list.id, name: m.name, quantity: m.quantity, unit: m.unit, aisle: m.aisle,
  })));
  const full = await GroceryList.findByPk(list.id, { include: [GroceryItem], order: [[GroceryItem, 'id', 'ASC']] });
  res.status(201).json({ list: listJson(full), stats: { ingredientLines: lines.length, shoppingItems: merged.length } });
});

router.get('/', async (req, res) => {
  const lists = await GroceryList.findAll({ where: { UserId: req.user.id }, include: [GroceryItem], order: [['id', 'DESC']] });
  res.json({
    lists: lists.map((l) => ({
      id: l.id,
      name: l.name,
      createdAt: l.createdAt,
      total: l.GroceryItems.length,
      done: l.GroceryItems.filter((i) => i.checked).length,
    })),
  });
});

router.get('/:id', validate(schemas.idParam, 'params'), async (req, res) => {
  res.json({ list: listJson(await findOwnedList(req)) });
});

router.patch('/:id/items/:itemId', validate(schemas.groceryItem, 'params'), validate(schemas.groceryItemPatch), async (req, res) => {
  const list = await findOwnedList(req);
  const item = list.GroceryItems.find((i) => i.id === req.valid.params.itemId);
  if (!item) throw new AppError(404, 'We could not find that item.');
  await item.update({ checked: req.valid.body.checked });
  res.json({ item: itemJson(item) });
});

router.delete('/:id', validate(schemas.idParam, 'params'), async (req, res) => {
  const list = await findOwnedList(req);
  await list.destroy();
  res.status(204).end();
});

module.exports = router;
