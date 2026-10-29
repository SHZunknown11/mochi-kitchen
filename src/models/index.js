const { DataTypes } = require('sequelize');
const sequelize = require('../db/sequelize');

// JSON columns are stored as TEXT so the same models work on SQLite and MySQL.
const jsonColumn = (name, fallback) => ({
  type: DataTypes.TEXT,
  allowNull: false,
  defaultValue: JSON.stringify(fallback),
  get() {
    try {
      return JSON.parse(this.getDataValue(name));
    } catch {
      return fallback;
    }
  },
  set(value) {
    this.setDataValue(name, JSON.stringify(value ?? fallback));
  },
});

const User = sequelize.define('User', {
  username: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  email: { type: DataTypes.STRING(120), allowNull: false, unique: true },
  passwordHash: { type: DataTypes.STRING(100), allowNull: false },
  // { diet: 'none'|'vegetarian'|'vegan', glutenFree: boolean, maxCalories: number|null }
  dietPrefs: jsonColumn('dietPrefs', { diet: 'none', glutenFree: false, maxCalories: null }),
}, { tableName: 'users' });

const RefreshToken = sequelize.define('RefreshToken', {
  tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
  revoked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, { tableName: 'refresh_tokens' });

const Recipe = sequelize.define('Recipe', {
  source: { type: DataTypes.STRING(20), allowNull: false }, // seed | mealdb | gemini | spoonacular
  externalId: { type: DataTypes.STRING(64), allowNull: false },
  title: { type: DataTypes.STRING(160), allowNull: false },
  category: { type: DataTypes.STRING(60) },
  area: { type: DataTypes.STRING(60) },
  summary: { type: DataTypes.TEXT },
  instructions: { type: DataTypes.TEXT, allowNull: false },
  thumb: { type: DataTypes.STRING(300) },
  youtube: { type: DataTypes.STRING(300) },
  calories: { type: DataTypes.INTEGER }, // per serving, always an estimate
  caloriesSource: { type: DataTypes.STRING(20) }, // 'estimate' | 'ai'
  isVegetarian: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  isVegan: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  isGlutenFree: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  tags: jsonColumn('tags', []),
}, {
  tableName: 'recipes',
  indexes: [{ unique: true, fields: ['source', 'externalId'] }],
});

const Ingredient = sequelize.define('Ingredient', {
  name: { type: DataTypes.STRING(120), allowNull: false },
  measure: { type: DataTypes.STRING(80) }, // original text, e.g. "1 1/2 cups"
  quantity: { type: DataTypes.FLOAT }, // parsed, may be null ("to taste")
  unit: { type: DataTypes.STRING(20) },
}, { tableName: 'ingredients' });

const Favourite = sequelize.define('Favourite', {}, {
  tableName: 'favourites',
  indexes: [{ unique: true, fields: ['UserId', 'RecipeId'] }],
});

const GroceryList = sequelize.define('GroceryList', {
  name: { type: DataTypes.STRING(80), allowNull: false },
  recipeIds: jsonColumn('recipeIds', []),
}, { tableName: 'grocery_lists' });

const GroceryItem = sequelize.define('GroceryItem', {
  name: { type: DataTypes.STRING(120), allowNull: false },
  quantity: { type: DataTypes.FLOAT },
  unit: { type: DataTypes.STRING(20) },
  aisle: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'other' },
  checked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, { tableName: 'grocery_items' });

const PantryItem = sequelize.define('PantryItem', {
  name: { type: DataTypes.STRING(120), allowNull: false },
}, {
  tableName: 'pantry_items',
  indexes: [{ unique: true, fields: ['UserId', 'name'] }],
});

const MealPlan = sequelize.define('MealPlan', {
  days: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 7 },
  plan: jsonColumn('plan', []),
  generatedBy: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'local' }, // ai | local
}, { tableName: 'meal_plans' });

const ApiCache = sequelize.define('ApiCache', {
  key: { type: DataTypes.STRING(200), allowNull: false, unique: true },
  payload: {
    type: sequelize.getDialect() === 'mysql' ? DataTypes.TEXT('long') : DataTypes.TEXT,
    allowNull: false,
  },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
}, { tableName: 'api_cache' });

// --- Associations -----------------------------------------------------------
User.hasMany(RefreshToken, { onDelete: 'CASCADE' });
RefreshToken.belongsTo(User);

Recipe.hasMany(Ingredient, { onDelete: 'CASCADE' });
Ingredient.belongsTo(Recipe);

User.hasMany(Favourite, { onDelete: 'CASCADE' });
Favourite.belongsTo(User);
Recipe.hasMany(Favourite, { onDelete: 'CASCADE' });
Favourite.belongsTo(Recipe);

User.hasMany(GroceryList, { onDelete: 'CASCADE' });
GroceryList.belongsTo(User);
GroceryList.hasMany(GroceryItem, { onDelete: 'CASCADE' });
GroceryItem.belongsTo(GroceryList);

User.hasMany(PantryItem, { onDelete: 'CASCADE' });
PantryItem.belongsTo(User);

User.hasMany(MealPlan, { onDelete: 'CASCADE' });
MealPlan.belongsTo(User);

module.exports = {
  sequelize,
  User,
  RefreshToken,
  Recipe,
  Ingredient,
  Favourite,
  GroceryList,
  GroceryItem,
  PantryItem,
  MealPlan,
  ApiCache,
};
