import { execFileSync } from 'node:child_process';

const outputDir = '/tmp/story-weaver-package-smoke';

execFileSync('pnpm', ['run', 'build'], { stdio: 'inherit' });

execFileSync(
  'pnpm',
  [
    'exec',
    'electron-builder',
    '--dir',
    `--config.directories.output=${outputDir}`,
  ],
  { stdio: 'inherit' }
);

const appAsar = `${outputDir}/mac-arm64/Story Weaver.app/Contents/Resources/app.asar`;
const listing = execFileSync('pnpm', ['exec', 'asar', 'list', appAsar], {
  encoding: 'utf8',
});

for (const expected of [
  '/packages/frontend/dist/index.html',
  '/packages/backend/dist/',
  '/packages/shared/dist/',
  '/dist-electron/',
  '/drizzle/meta/_journal.json',
  'better_sqlite3.node',
]) {
  if (!listing.includes(expected)) {
    throw new Error(`Missing packaged artifact: ${expected}`);
  }
}
