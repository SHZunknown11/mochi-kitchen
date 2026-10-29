// Needs Playwright: npm i -D playwright && npx playwright install chromium
/* global document, window */
// Headless-browser walkthrough of the whole app. Works against local or live:
//   BASE_URL=https://mochi-kitchen.<you>.workers.dev node scripts/e2e.js
// Saves screenshots to ./e2e-shots and exits non-zero on any failure, console error or sideways scroll.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = (process.env.BASE_URL || 'http://localhost:8787').replace(/\/$/, '');
const SHOTS = path.join(__dirname, '..', 'e2e-shots');
fs.mkdirSync(SHOTS, { recursive: true });

const SIZES = [['phone', 360, 640], ['desktop', 1280, 800]];
const stamp = Date.now().toString(36);

async function walk(browser, [name, width, height], idx) {
  const problems = [];
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: width < 500, hasTouch: width < 500 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console error: ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  page.on('response', (r) => { if (r.url().startsWith(BASE) && r.status() >= 500) problems.push(`HTTP ${r.status()} ${r.url()}`); });

  const shot = async (label) => { await page.waitForTimeout(900); await page.screenshot({ path: path.join(SHOTS, `${name}-${label}.png`), fullPage: true }); };
  const noSideScroll = async (label) => {
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (over > 1) problems.push(`horizontal scroll (${over}px) on ${label}`);
  };
  const t0 = Date.now();
  const timings = {};
  const time = async (label, fn) => { const s = Date.now(); const r = await fn(); timings[label] = Date.now() - s; return r; };

  page.on('close', () => {});
  const user = `e2e_${stamp}${idx}`;
  try {
  const pass = 'Mochi1234ok';

  await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' });
  await shot('1-home'); await noSideScroll('home');

  // register
  await page.goto(`${BASE}/#/login`);
  await page.getByRole('button', { name: 'I need an account' }).click();
  await page.fill('#username', user);
  await page.fill('#email', `${user}@example.com`);
  await page.fill('#password', pass);
  await time('register', async () => { await page.getByRole('button', { name: 'Create account' }).click(); await page.getByRole('link', { name: user }).waitFor(); });
  await shot('2-registered');

  // log out, log back in
  await page.goto(`${BASE}/#/profile`);
  await page.getByRole('button', { name: /log ?out/i }).click();
  await page.getByRole('link', { name: 'Log in' }).waitFor();
  await page.goto(`${BASE}/#/login`);
  await page.fill('#identifier', user);
  await page.fill('#password', pass);
  await time('login', async () => { await page.getByRole('button', { name: 'Log in', exact: true }).click(); await page.getByRole('link', { name: user }).waitFor(); });

  // search
  await page.goto(`${BASE}/#/`);
  await page.getByLabel('Describe what you want to eat').fill('spicy vegan kimchi under 500 calories');
  await time('search', async () => { await page.getByRole('button', { name: 'Find recipes' }).first().click(); await page.locator('.recipe-card').first().waitFor({ timeout: 30000 }); });
  const cards = await page.locator('.recipe-card').count();
  if (cards === 0) problems.push('search returned no recipes');
  await shot('3-search'); await noSideScroll('search');

  // pick three recipes for a list (browse by diet if the sentence gave fewer than three)
  if (cards < 3) {
    await page.getByRole('tab').last().click().catch(() => {});
    await page.getByRole('button', { name: 'Show recipes' }).click().catch(() => {});
    await page.locator('.recipe-card').nth(2).waitFor({ timeout: 30000 });
  }
  // heart + open recipe
  await page.locator('.recipe-card .heart').first().click();
  await page.locator('.recipe-card h3 a').first().click();
  await page.locator('h1, h2').first().waitFor();
  await page.waitForTimeout(800);
  await shot('4-recipe'); await noSideScroll('recipe');
  await page.goBack();
  await page.locator('.recipe-card').first().waitFor();
  const picks = page.locator('.recipe-card .pick input');
  const n = Math.min(3, await picks.count());
  for (let i = 0; i < n; i += 1) await picks.nth(i).check();
  await time('shopping list', async () => { await page.getByRole('button', { name: 'Make shopping list' }).click(); await page.waitForURL(/#\/lists\/\d+/); await page.locator('input[type=checkbox]').first().waitFor(); });
  await shot('5-list'); await noSideScroll('list');
  await page.locator('input[type=checkbox]').first().check();

  // favourites
  await page.goto(`${BASE}/#/favourites`);
  await page.locator('.recipe-card').first().waitFor();
  await shot('6-favourites'); await noSideScroll('favourites');

  // pantry
  await page.goto(`${BASE}/#/pantry`);
  for (const item of ['kimchi', 'tofu', 'rice']) {
    await page.getByLabel('Add a pantry ingredient').fill(item);
    await page.getByRole('button', { name: 'Add' }).click();
    await page.getByRole('button', { name: `Remove ${item}` }).waitFor();
  }
  await page.locator('.recipe-card').first().waitFor({ timeout: 15000 });
  await shot('7-pantry'); await noSideScroll('pantry');

  // planner
  await page.goto(`${BASE}/#/planner`);
  await time('meal plan', async () => { await page.getByRole('button', { name: 'Plan my meals' }).click(); await page.locator('.day-card').first().waitFor({ timeout: 30000 }); });
  await shot('8-planner'); await noSideScroll('planner');

  // profile + logout
  await page.goto(`${BASE}/#/profile`);
  await shot('9-profile'); await noSideScroll('profile');
  await page.getByRole('button', { name: /log ?out/i }).click();
  await page.getByRole('link', { name: 'Log in' }).waitFor();

  } catch (err) {
    await page.screenshot({ path: path.join(SHOTS, `${name}-FAILED.png`) }).catch(() => {});
    err.message = `${err.message.split('\n').slice(0, 3).join(' | ')} [url ${page.url()}]`;
    throw err;
  }
  await ctx.close();
  return { name, problems, timings, seconds: ((Date.now() - t0) / 1000).toFixed(1) };
}

(async () => {
  const browser = await chromium.launch();
  let bad = 0;
  for (const [i, size] of SIZES.entries()) {
    try {
      const r = await walk(browser, size, i);
      console.log(`${r.name} ${size[1]}x${size[2]}: ${r.problems.length ? 'PROBLEMS' : 'ok'} in ${r.seconds}s`, JSON.stringify(r.timings));
      r.problems.forEach((p) => console.log(`   - ${p}`));
      bad += r.problems.length;
    } catch (err) {
      bad += 1;
      console.log(`${size[0]}: FAILED - ${err.message.split('\n')[0]}`);
    }
  }
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
