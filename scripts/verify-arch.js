process.env.NODE_ENV = 'test';
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { createApp } = require('../src/app');
const sequelize = require('../src/db/sequelize');
const { migrateUp } = require('../src/db/migrate');
const { seedAll } = require('../src/db/seed');
const { Recipe, Ingredient } = require('../src/models');

async function testArchitecture() {
  console.log('====================================================');
  console.log('   MOCHI KITCHEN ARCHITECTURAL HEALTH & E2E CHECK   ');
  console.log('====================================================\n');

  await sequelize.authenticate();
  await migrateUp();
  await seedAll();
  const app = createApp();
  let passCount = 0;
  let failCount = 0;

  function assert(name, condition, details = '') {
    if (condition) {
      console.log('  [PASS]', name);
      passCount++;
    } else {
      console.error('  [FAIL]', name, details ? '- ' + details : '');
      failCount++;
    }
  }

  // --- 1. FRONTEND ASSETS & REACT INTEGRATION ---
  console.log('--- 1. Frontend & React Bundle Verification ---');
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  assert('index.html contains React 18 vendor script', indexHtml.includes('/vendor/react.min.js'));
  assert('index.html contains ReactDOM vendor script', indexHtml.includes('/vendor/react-dom.min.js'));
  assert('index.html contains main app module', indexHtml.includes('/js/app.js'));

  const reactVendor = fs.readFileSync(path.join(__dirname, '..', 'public', 'vendor', 'react.min.js'), 'utf8');
  const reactDomVendor = fs.readFileSync(path.join(__dirname, '..', 'public', 'vendor', 'react-dom.min.js'), 'utf8');
  assert('react.min.js is present & valid (>10KB)', reactVendor.length > 10000);
  assert('react-dom.min.js is present & valid (>120KB)', reactDomVendor.length > 120000);

  const reactBridge = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'react.js'), 'utf8');
  assert('react.js exports mountReact & hooks', reactBridge.includes('mountReact') && reactBridge.includes('useState'));

  const kitchenVibe = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'kitchenVibe.js'), 'utf8');
  assert('kitchenVibe.js contains KitchenLiveBar', kitchenVibe.includes('KitchenLiveBar'));
  assert('kitchenVibe.js contains ChefTimer', kitchenVibe.includes('ChefTimer'));
  assert('kitchenVibe.js contains FloatingKitchenAmbiance', kitchenVibe.includes('FloatingKitchenAmbiance'));
  assert('kitchenVibe.js contains KitchenCookAlong', kitchenVibe.includes('KitchenCookAlong'));
  assert('kitchenVibe.js contains Web Audio synthesizer', kitchenVibe.includes('KitchenSoundEngine'));

  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'styles.css'), 'utf8');
  assert('styles.css has kitchen animations (@keyframes steamDrift, wokToss)', css.includes('steamDrift') && css.includes('wokToss'));

  // --- 2. HTTP SERVER & SECURITY HEADERS ---
  console.log('\n--- 2. Server Middleware & Security Headers ---');
  const healthRes = await request(app).get('/api/health');
  assert('GET /api/health returns 200 OK', healthRes.status === 200 && healthRes.body.ok === true);
  assert('Helmet Content-Security-Policy header active', Boolean(healthRes.headers['content-security-policy']));
  assert("CSP permits script-src 'self'", healthRes.headers['content-security-policy'].includes("script-src 'self'"));
  assert('X-Content-Type-Options: nosniff present', healthRes.headers['x-content-type-options'] === 'nosniff');

  const aiStatus = await request(app).get('/api/ai/status');
  assert('GET /api/ai/status responds gracefully', aiStatus.status === 200 && typeof aiStatus.body.configured === 'boolean');

  // --- 3. DATABASE INTEGRITY & NO-BEEF VERIFICATION ---
  console.log('\n--- 3. Database Layer & Beef-Free Menu Verification ---');
  await sequelize.authenticate();
  const seedRecipesCount = await Recipe.count({ where: { source: 'seed' } });
  assert('SQLite database has 45 active starter recipes', seedRecipesCount === 45, 'got ' + seedRecipesCount);

  const allDbRecipes = await Recipe.findAll({
    include: [{ model: Ingredient, as: 'Ingredients' }],
  });
  const foundBeef = allDbRecipes.filter((r) => {
    const text = (r.title + ' ' + (r.summary || '') + ' ' + (r.category || '')).toLowerCase();
    const hasInTitle = /\bbeef\b|\bsteak\b|\bbrisket\b|\bbulgogi\b|\bgyudon\b/.test(text);
    const hasInIngs = (r.Ingredients || []).some((i) => /\bbeef\b|\bsteak\b|\bbrisket\b/.test(i.name.toLowerCase()));
    return hasInTitle || hasInIngs;
  });
  assert('Zero beef recipes exist in the entire database (seeds + imported)', foundBeef.length === 0, 'Found: ' + foundBeef.map((b) => b.title).join(', '));

  // --- 4. AUTHENTICATION WORKFLOW ---
  console.log('\n--- 4. Authentication & Security Flow ---');
  const randUser = 'chef_' + Math.random().toString(36).slice(2, 8);
  const regRes = await request(app).post('/api/auth/register').send({
    username: randUser,
    email: randUser + '@example.com',
    password: 'Password123!',
  });
  assert('POST /api/auth/register creates user and returns JWT token', regRes.status === 201 && Boolean(regRes.body.accessToken), JSON.stringify(regRes.body));

  const token = regRes.body.accessToken;
  const meRes = await request(app).get('/api/auth/me').set('Authorization', 'Bearer ' + token);
  assert('GET /api/auth/me returns authenticated profile', meRes.status === 200 && meRes.body.user.username === randUser);

  const patchDiet = await request(app).patch('/api/auth/me').set('Authorization', 'Bearer ' + token).send({
    dietPrefs: { diet: 'vegetarian', glutenFree: false, maxCalories: 600 },
  });
  assert('PATCH /api/auth/me saves diet preferences', patchDiet.status === 200 && patchDiet.body.user.dietPrefs.diet === 'vegetarian');

  // --- 5. RECIPES & SEARCH ARCHITECTURE ---
  console.log('\n--- 5. Search Engine & Recipe APIs ---');
  const searchTofu = await request(app).post('/api/search').send({ mode: 'text', query: 'tofu stew' });
  assert('NLP text search for "tofu stew" returns matches', searchTofu.status === 200 && searchTofu.body.results.length > 0);

  const searchBeef = await request(app).post('/api/search').send({ mode: 'text', query: 'beef bowl' });
  const anyBeefReturned = searchBeef.body.results.some((r) => /\bbeef\b|\bsteak\b|\bbrisket\b|\bbulgogi\b|\bgyudon\b/i.test(r.title));
  assert('Search query for beef returns 0 beef recipes (strictly filtered out)', !anyBeefReturned);

  const searchIngs = await request(app).post('/api/search').send({ mode: 'ingredients', ingredients: ['spinach', 'tofu'] });
  assert('Ingredient search mode works correctly', searchIngs.status === 200 && searchIngs.body.results.length > 0);

  const sampleRecipeId = searchTofu.body.results[0].id;
  const detailRes = await request(app).get('/api/recipes/' + sampleRecipeId);
  assert('GET /api/recipes/:id returns full recipe with ingredients and steps',
    detailRes.status === 200 && Array.isArray(detailRes.body.ingredients) && Array.isArray(detailRes.body.steps));

  const pairingRes = await request(app).get('/api/recipes/' + sampleRecipeId + '/pairing');
  assert('GET /api/recipes/:id/pairing handles drink pairing', pairingRes.status === 200 && Object.prototype.hasOwnProperty.call(pairingRes.body, 'drink'));

  // --- 6. FAVOURITES, PANTRY, GROCERY & PLANNER ---
  console.log('\n--- 6. Kitchen Operations (Favourites, Pantry, Grocery, Planner) ---');
  const favRes = await request(app).post('/api/favourites').set('Authorization', 'Bearer ' + token).send({ recipeId: sampleRecipeId });
  assert('POST /api/favourites adds a favourite', favRes.status === 201);

  const listFav = await request(app).get('/api/favourites').set('Authorization', 'Bearer ' + token);
  assert('GET /api/favourites lists favourite recipes', listFav.body.favourites.length === 1 && listFav.body.favourites[0].id === sampleRecipeId);

  const pantryRes = await request(app).post('/api/pantry').set('Authorization', 'Bearer ' + token).send({ name: 'kimchi' });
  assert('POST /api/pantry adds pantry item', pantryRes.status === 201 && pantryRes.body.item.name === 'kimchi');

  const matchRes = await request(app).get('/api/pantry/match').set('Authorization', 'Bearer ' + token);
  assert('GET /api/pantry/match calculates recipe coverage based on pantry', matchRes.status === 200 && Array.isArray(matchRes.body.recipes));

  const otherRecipeId = searchIngs.body.results[0].id;
  const recipeIds = Array.from(new Set([sampleRecipeId, otherRecipeId]));
  const listRes = await request(app).post('/api/grocery').set('Authorization', 'Bearer ' + token).send({
    recipeIds,
    name: 'Weekly Kitchen Prep',
  });
  assert('POST /api/grocery aggregates ingredients and creates shopping list', listRes.status === 201 && listRes.body.list.items.length > 0);

  const planRes = await request(app).post('/api/mealplan').set('Authorization', 'Bearer ' + token).send({
    days: 3,
    provider: 'free',
  });
  assert('POST /api/mealplan generates 3-day balanced meal plan', planRes.status === 201 && planRes.body.plan.length === 3);

  // --- 7. JAVA FULL-STACK MICROSERVICE & RESILIENCE ---
  console.log('\n--- 7. Java Full-Stack Microservice & Resilience ---');
  const javaMainExists = fs.existsSync(path.join(__dirname, '..', 'java-service', 'src', 'main', 'java', 'com', 'mochi', 'kitchen', 'Main.java'));
  assert('Java source code structure is present (JDK 25 / Maven layout)', javaMainExists);

  const javaHealthRes = await request(app).get('/api/java/health');
  assert('GET /api/java/health returns 200 with service description (live or fallback)',
    javaHealthRes.status === 200 && javaHealthRes.body.service.includes('Java'));

  const javaNutritionRes = await request(app).post('/api/java/nutrition').send({
    title: 'Matcha Bowl',
    servings: 1,
    ingredients: [{ name: 'matcha powder', measure: '1 tsp' }, { name: 'oat milk', measure: '200ml' }],
  });
  assert('POST /api/java/nutrition calculates or falls back with macro stats',
    javaNutritionRes.status === 200 && typeof javaNutritionRes.body.calories === 'number');

  const javaWorkloadRes = await request(app).post('/api/java/workload').send({
    steps: ['Whisk matcha with warm water until frothy', 'Pour steamed oat milk over top'],
    ingredientCount: 2,
  });
  assert('POST /api/java/workload computes kitchen workload and equipment',
    javaWorkloadRes.status === 200 && typeof javaWorkloadRes.body.totalMinutes === 'number');

  // --- SUMMARY ---
  console.log('\n====================================================');
  console.log('   VERIFICATION SUMMARY: ' + passCount + ' PASSED, ' + failCount + ' FAILED');
  console.log('====================================================');
  if (failCount > 0) process.exit(1);
}

testArchitecture().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
