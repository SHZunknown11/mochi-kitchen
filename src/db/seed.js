const sequelize = require('./sequelize');
const { saveRecipe } = require('../services/recipeStore');
const seedRecipes = require('../data/seedRecipes');

/** Insert the starter recipes. Safe to run again: existing recipes are left alone. */
async function seedAll() {
  let created = 0;
  for (const dto of seedRecipes) {
    const { Recipe } = require('../models');
    const before = await Recipe.count({ where: { source: dto.source, externalId: dto.externalId } });
    await saveRecipe(dto);
    if (before === 0) created += 1;
  }
  return { total: seedRecipes.length, created };
}

module.exports = { seedAll };

if (require.main === module) {
  seedAll()
    .then(({ total, created }) => {
      console.log(`Seed finished: ${created} new recipe(s), ${total} in the starter set.`);
      return sequelize.close();
    })
    .catch((err) => {
      console.error('Seeding failed:', err.message);
      process.exit(1);
    });
}
