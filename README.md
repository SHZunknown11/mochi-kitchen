# Mochi Kitchen

A cute, Korean/Japanese-illustrated **AI recipe finder**. Describe a craving ("something spicy with tofu and kimchi, vegan, under 500 calories"), list what is in your fridge, or just set your diet, and Mochi the rice-ball cat finds recipes, builds shopping lists, tracks your pantry and plans your week.

Built as a Full Stack Development II project (Node.js, Express, Sequelize, SQLite/MySQL, vanilla JS).

## Features

| Area | What it does |
|---|---|
| **NLP search** | Tokenises and stems free text, removes filler words, detects ingredients, cuisine, meal type, flavour, diet (`vegan`, `gluten free`) and calorie limits (`under 500 calories`) |
| **Recipe sources** | Built-in starter recipes + [TheMealDB](https://www.themealdb.com/api.php) (free, no key) + optional **Google Gemini** ideas. Responses are cached in the database |
| **Dietary filters** | Vegetarian, vegan, gluten-free and calorie range. Diets are worked out from ingredient names, calories are always shown as *approx.* or *AI estimate* |
| **Accounts** | Register/login, bcrypt hashing, short-lived JWT access tokens, rotating hashed refresh tokens with replay detection, saved dietary profile |
| **Favourites** | Save, remove and list recipes per user |
| **Shopping lists** | Pick recipes and Mochi merges and de-duplicates ingredients (units are added up: `500 g + 0.7 kg = 1.2 kg`), grouped by aisle, tick items off |
| **Pantry** | "What can I cook with what I have?" ranks recipes by how much you already own and lists what is missing |
| **Meal planner** | Lunch + dinner for 3-7 days that respect your diet profile, by Gemini or by a free local planner |
| **Drink pairing** | Non-alcoholic suggestion from [TheCocktailDB](https://www.thecocktaildb.com/api.php) |
| **Security** | Joi validation on every input, rate limiting (general, login, AI), helmet + CSP, ownership checks, no raw user text in HTML |

## Quick start

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
git clone https://github.com/<your-account>/mochi-kitchen.git
cd mochi-kitchen
npm install
cp .env.example .env        # Windows: copy .env.example .env
npm start                   # opens on http://localhost:3000
```

On Windows you can double-click `build.bat` once and then `run.bat`.

The first start creates the SQLite database in `data/` and loads the starter recipes automatically.

### Add your own Gemini API key (optional, for the AI features)

**This repository contains no API key.** To switch on "Mochi AI" search and the AI meal planner:

1. Create a free key at <https://aistudio.google.com/apikey>.
2. Open your local `.env` file and set `GEMINI_API_KEY=your-key-here`.
3. Restart the server.

Never commit `.env` (it is already in `.gitignore`). Without a key the app works fully in *free mode*: the "Mochi AI" buttons are greyed out and everything else is available.

### Using MySQL instead of SQLite

```bash
npm install mysql2
```

Then set `DB_DIALECT=mysql` and the `DB_*` values in `.env`, create the empty database, and run `npm run setup`.

## Scripts

| Command | Purpose |
|---|---|
| `npm start` | Start the server (runs migrations and seeds on first start) |
| `npm run dev` | Start with auto-restart |
| `npm run setup` | Run migrations and seed the starter recipes |
| `npm run migrate` / `migrate:down` | Apply / revert the latest migration |
| `npm test` | Run the Jest suite |
| `npm run test:coverage` | Tests with a coverage table |
| `npm run lint` | ESLint |

## Project layout

```
src/
  app.js, server.js        Express app and start-up
  config/                  environment configuration
  db/                      Sequelize instance, migration runner, seeder
  migrations/              database schema (umzug)
  models/                  Sequelize models and associations
  routes/                  HTTP endpoints + Joi schemas
  middleware/              auth guard, validation, rate limits, errors
  services/                nlp, diet, grocery, search, gemini, mealplan, pantry, cache, providers/
  data/                    word lists and the starter recipes
public/                    the single-page front end (HTML, CSS, JS modules, SVG art)
tests/                     Jest + supertest
```

## API overview

All bodies are JSON. Protected routes need `Authorization: Bearer <accessToken>`.

| Method and path | Auth | Description |
|---|---|---|
| `POST /api/auth/register`, `/login`, `/refresh`, `/logout` | - | account and tokens |
| `GET/PATCH /api/auth/me` | yes | profile and dietary preferences |
| `POST /api/search` | optional | `{ mode, query, ingredients, diet, provider }` |
| `GET /api/recipes/:id`, `/api/recipes/:id/pairing` | - | recipe details, drink pairing |
| `GET/POST /api/favourites`, `DELETE /api/favourites/:recipeId` | yes | favourites |
| `POST/GET /api/grocery`, `GET/DELETE /api/grocery/:id`, `PATCH /api/grocery/:id/items/:itemId` | yes | shopping lists |
| `GET/POST /api/pantry`, `DELETE /api/pantry/:id`, `GET /api/pantry/match` | yes | pantry and "what can I cook" |
| `POST/GET /api/mealplan` | yes | weekly meal plan |
| `GET /api/ai/status`, `GET /api/health` | - | status |

## Honest notes

- Diet tags are decided from ingredient **names**, so hidden ingredients in sauces can't be seen. Always check labels if you have an allergy.
- Calories are rough estimates (from a small ingredient table, or from the AI) and are labelled that way.
- Only extracted keywords are sent to Gemini, never the raw sentence, and every AI answer is validated before it is stored or shown.

## Credits

Recipe data and photos from TheMealDB and TheCocktailDB. Illustrations are drawn in code for this project. Fonts: Jua, Gamja Flower, Zen Maru Gothic and Fredoka from Google Fonts.

License: MIT
