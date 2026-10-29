const { DataTypes } = require('sequelize');

const id = { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false };
const timestamps = {
  createdAt: { type: DataTypes.DATE, allowNull: false },
  updatedAt: { type: DataTypes.DATE, allowNull: false },
};
const fk = (table, allowNull = false) => ({
  type: DataTypes.INTEGER,
  allowNull,
  references: { model: table, key: 'id' },
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

module.exports = {
  async up({ context: qi }) {
    await qi.createTable('users', {
      id,
      username: { type: DataTypes.STRING(30), allowNull: false, unique: true },
      email: { type: DataTypes.STRING(120), allowNull: false, unique: true },
      passwordHash: { type: DataTypes.STRING(100), allowNull: false },
      dietPrefs: { type: DataTypes.TEXT, allowNull: false },
      ...timestamps,
    });

    await qi.createTable('refresh_tokens', {
      id,
      tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      revoked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      UserId: fk('users'),
      ...timestamps,
    });

    await qi.createTable('recipes', {
      id,
      source: { type: DataTypes.STRING(20), allowNull: false },
      externalId: { type: DataTypes.STRING(64), allowNull: false },
      title: { type: DataTypes.STRING(160), allowNull: false },
      category: { type: DataTypes.STRING(60) },
      area: { type: DataTypes.STRING(60) },
      summary: { type: DataTypes.TEXT },
      instructions: { type: DataTypes.TEXT, allowNull: false },
      thumb: { type: DataTypes.STRING(300) },
      youtube: { type: DataTypes.STRING(300) },
      calories: { type: DataTypes.INTEGER },
      caloriesSource: { type: DataTypes.STRING(20) },
      isVegetarian: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      isVegan: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      isGlutenFree: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      tags: { type: DataTypes.TEXT, allowNull: false },
      ...timestamps,
    });
    await qi.addIndex('recipes', ['source', 'externalId'], { unique: true });

    await qi.createTable('ingredients', {
      id,
      name: { type: DataTypes.STRING(120), allowNull: false },
      measure: { type: DataTypes.STRING(80) },
      quantity: { type: DataTypes.FLOAT },
      unit: { type: DataTypes.STRING(20) },
      RecipeId: fk('recipes'),
      ...timestamps,
    });

    await qi.createTable('favourites', {
      id,
      UserId: fk('users'),
      RecipeId: fk('recipes'),
      ...timestamps,
    });
    await qi.addIndex('favourites', ['UserId', 'RecipeId'], { unique: true });

    await qi.createTable('grocery_lists', {
      id,
      name: { type: DataTypes.STRING(80), allowNull: false },
      recipeIds: { type: DataTypes.TEXT, allowNull: false },
      UserId: fk('users'),
      ...timestamps,
    });

    await qi.createTable('grocery_items', {
      id,
      name: { type: DataTypes.STRING(120), allowNull: false },
      quantity: { type: DataTypes.FLOAT },
      unit: { type: DataTypes.STRING(20) },
      aisle: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'other' },
      checked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      GroceryListId: fk('grocery_lists'),
      ...timestamps,
    });

    await qi.createTable('pantry_items', {
      id,
      name: { type: DataTypes.STRING(120), allowNull: false },
      UserId: fk('users'),
      ...timestamps,
    });
    await qi.addIndex('pantry_items', ['UserId', 'name'], { unique: true });

    await qi.createTable('meal_plans', {
      id,
      days: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 7 },
      plan: { type: DataTypes.TEXT, allowNull: false },
      generatedBy: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'local' },
      UserId: fk('users'),
      ...timestamps,
    });

    await qi.createTable('api_cache', {
      id,
      key: { type: DataTypes.STRING(200), allowNull: false, unique: true },
      payload: {
        type: qi.sequelize.getDialect() === 'mysql' ? DataTypes.TEXT('long') : DataTypes.TEXT,
        allowNull: false,
      },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      ...timestamps,
    });
  },

  async down({ context: qi }) {
    for (const table of [
      'api_cache', 'meal_plans', 'pantry_items', 'grocery_items', 'grocery_lists',
      'favourites', 'ingredients', 'recipes', 'refresh_tokens', 'users',
    ]) {
      await qi.dropTable(table);
    }
  },
};
