-- Mochi Kitchen schema for Cloudflare D1 (SQLite). Timestamps are ISO-8601 text, booleans are 0/1,
-- JSON columns are TEXT. Mirrors src/migrations/001-init.js used by the Node app.
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  passwordHash TEXT NOT NULL,
  dietPrefs TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tokenHash TEXT NOT NULL UNIQUE,
  expiresAt TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  UserId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX idx_refresh_user ON refresh_tokens(UserId);

CREATE TABLE recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  externalId TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT,
  area TEXT,
  summary TEXT,
  instructions TEXT NOT NULL,
  thumb TEXT,
  youtube TEXT,
  calories INTEGER,
  caloriesSource TEXT,
  isVegetarian INTEGER NOT NULL DEFAULT 0,
  isVegan INTEGER NOT NULL DEFAULT 0,
  isGlutenFree INTEGER NOT NULL DEFAULT 0,
  tags TEXT NOT NULL DEFAULT '[]',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_recipes_source_ext ON recipes(source, externalId);

CREATE TABLE ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  measure TEXT,
  quantity REAL,
  unit TEXT,
  RecipeId INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX idx_ingredients_recipe ON ingredients(RecipeId);

CREATE TABLE favourites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  UserId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  RecipeId INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_fav_user_recipe ON favourites(UserId, RecipeId);

CREATE TABLE grocery_lists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  recipeIds TEXT NOT NULL,
  UserId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX idx_lists_user ON grocery_lists(UserId);

CREATE TABLE grocery_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  quantity REAL,
  unit TEXT,
  aisle TEXT NOT NULL DEFAULT 'other',
  checked INTEGER NOT NULL DEFAULT 0,
  GroceryListId INTEGER NOT NULL REFERENCES grocery_lists(id) ON DELETE CASCADE,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX idx_items_list ON grocery_items(GroceryListId);

CREATE TABLE pantry_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  UserId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_pantry_user_name ON pantry_items(UserId, name);

CREATE TABLE meal_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  days INTEGER NOT NULL DEFAULT 7,
  plan TEXT NOT NULL,
  generatedBy TEXT NOT NULL DEFAULT 'local',
  UserId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX idx_plans_user ON meal_plans(UserId);

CREATE TABLE api_cache (
  key TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  expiresAt TEXT NOT NULL
);

-- Fixed-window counters for login/register/refresh brute-force protection.
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  windowStart INTEGER NOT NULL,
  count INTEGER NOT NULL
);
