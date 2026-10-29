// One-command deploy to Cloudflare (free plan):  npm run deploy
// Safe to re-run. It never writes a secret to disk: JWT secrets are generated in memory and piped
// straight into `wrangler secret put`; the Gemini key is typed at a prompt (or skipped).
const { spawnSync } = require('child_process');
const crypto = require('crypto');
const readline = require('readline');

const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const wrangler = (args, opts = {}) => spawnSync(NPX, ['wrangler', ...args], { shell: process.platform === 'win32', encoding: 'utf8', ...opts });
const step = (msg) => console.log(`\n=== ${msg}`);
const fail = (msg) => { console.error(`\nStopped: ${msg}`); process.exit(1); };

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); resolve(a.trim()); }));
}

function putSecret(name, value) {
  const r = wrangler(['secret', 'put', name], { input: value, stdio: ['pipe', 'pipe', 'inherit'] });
  if (r.status !== 0) fail(`could not set secret ${name}`);
  console.log(`  set ${name}`);
}

(async () => {
  step('1/5  Checking your Cloudflare login');
  const who = wrangler(['whoami'], { stdio: ['ignore', 'pipe', 'pipe'] });
  if (who.status !== 0 || /not authenticated/i.test(`${who.stdout}${who.stderr}`)) {
    console.log('A browser window will open so you can log in to Cloudflare...');
    if (wrangler(['login'], { stdio: 'inherit' }).status !== 0) fail('Cloudflare login did not complete.');
  } else {
    console.log('  logged in');
  }

  step('2/5  Preparing the database (tables + 49 starter recipes)');
  if (wrangler(['d1', 'migrations', 'apply', 'mochi-kitchen', '--remote'], { stdio: 'inherit' }).status !== 0) fail('database migration failed.');
  if (wrangler(['d1', 'execute', 'mochi-kitchen', '--remote', '--yes', '--file', 'worker/seed.sql'], { stdio: 'inherit' }).status !== 0) fail('seeding failed.');

  step('3/5  Deploying the Worker + front end');
  const deploy = wrangler(['deploy'], { encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] });
  process.stdout.write(deploy.stdout || '');
  if (deploy.status !== 0) fail('deploy failed.');
  const url = ((deploy.stdout || '').match(/https:\/\/[^\s]+\.workers\.dev/) || [])[0];

  step('4/5  Secrets');
  const have = wrangler(['secret', 'list', '--format', 'json'], { stdio: ['ignore', 'pipe', 'pipe'] }).stdout || '[]';
  const names = new Set((() => { try { return JSON.parse(have).map((s) => s.name); } catch { return []; } })());
  if (!names.has('JWT_ACCESS_SECRET')) putSecret('JWT_ACCESS_SECRET', crypto.randomBytes(48).toString('hex'));
  else console.log('  JWT_ACCESS_SECRET already set (kept, so nobody is logged out)');
  if (!names.has('JWT_REFRESH_SECRET')) putSecret('JWT_REFRESH_SECRET', crypto.randomBytes(48).toString('hex'));
  else console.log('  JWT_REFRESH_SECRET already set (kept)');

  if (!names.has('GEMINI_API_KEY')) {
    const key = await ask('\nOptional: paste a NEW Gemini API key for the AI mode (or press Enter to skip; the app works without it): ');
    if (key) putSecret('GEMINI_API_KEY', key);
    else console.log('  skipped (free mode only). Add it later with:  npx wrangler secret put GEMINI_API_KEY');
  } else {
    console.log('  GEMINI_API_KEY already set (kept)');
  }

  step('5/5  Done');
  console.log(url ? `\nYour app is live at:  ${url}\nSend that link to your friends.` : '\nDeployed. Open the *.workers.dev URL printed above.');
})();
