const { execFileSync } = require('node:child_process');

function resolveElectronVersion() {
  const pkg = require('../package.json');
  const versionRange =
    pkg.devDependencies?.electron ?? pkg.dependencies?.electron;

  if (typeof versionRange !== 'string') {
    throw new Error('Electron dependency is not declared in package.json');
  }

  const match = versionRange.match(/\d+\.\d+\.\d+(?:-[\w.-]+)?/);
  if (!match) {
    throw new Error(`Unable to parse Electron version from "${versionRange}"`);
  }

  return match[0];
}

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const electronVersion = resolveElectronVersion();

execFileSync(
  npmCommand,
  [
    'rebuild',
    'better-sqlite3',
    '--runtime=electron',
    `--target=${electronVersion}`,
    '--dist-url=https://electronjs.org/headers',
    '--build-from-source',
  ],
  {
    stdio: 'inherit',
  }
);
