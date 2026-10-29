const express = require('express');
const { Recipe, Favourite } = require('../models');
const { formatRecipe, withIngredients } = require('../services/recipeStore');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { AppError } = require('../middleware/error');
const schemas = require('./schemas');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const favourites = await Favourite.findAll({
    where: { UserId: req.user.id },
    include: [{ model: Recipe, ...withIngredients }],
    order: [['id', 'DESC']],
  });
  res.json({ favourites: favourites.map((f) => ({ ...formatRecipe(f.Recipe), isFavourite: true })) });
});

router.post('/', validate(schemas.favouriteAdd), async (req, res) => {
  const { recipeId } = req.valid.body;
  if (!(await Recipe.findByPk(recipeId, { attributes: ['id'] }))) throw new AppError(404, 'We could not find that recipe.');
  const [, created] = await Favourite.findOrCreate({ where: { UserId: req.user.id, RecipeId: recipeId } });
  res.status(created ? 201 : 200).json({ recipeId, isFavourite: true });
});

router.delete('/:recipeId', validate(schemas.recipeIdParam, 'params'), async (req, res) => {
  await Favourite.destroy({ where: { UserId: req.user.id, RecipeId: req.valid.params.recipeId } });
  res.status(204).end();
});

module.exports = router;
