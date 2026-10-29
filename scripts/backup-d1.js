// Export the whole live D1 database (schema + data) to a timestamped SQL file:  npm run d1:backup
// Restore into an empty database with:  npx wrangler d1 execute mochi-kitchen --remote --file <backup.sql>
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'worker', 'backups');
fs.mkdirSync(dir, { recursive: true });
const out = path.join(dir, `mochi-kitchen-${new Date().toISOString().replace(/[:.]/g, '-')}.sql`);
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const r = spawnSync(npx, ['wrangler', 'd1', 'export', 'mochi-kitchen', '--remote', '--output', out], { stdio: 'inherit', shell: process.platform === 'win32' });
if (r.status !== 0) { console.error('Backup failed. Are you logged in? Run: npx wrangler login'); process.exit(1); }
console.log(`\nBackup saved to ${out}\nIt contains user emails and password hashes: keep it private (worker/backups/ is git-ignored).`);
