import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(__dirname, '../..');

function listTrackedSourceFiles() {
  const output = execFileSync('git', ['ls-files'], {
    cwd: rootDir,
    encoding: 'utf8',
  });

  return output
    .split('\n')
    .filter(Boolean)
    .filter((file) => /\.(ts|tsx|cts|mts)$/.test(file))
    .filter((file) => existsSync(path.join(rootDir, file)))
    .filter((file) => !file.startsWith('dist'))
    .filter((file) => !file.startsWith('dist-electron'))
    .filter((file) => !file.startsWith('dist-server'));
}

function importsIn(file: string) {
  const source = readFileSync(path.join(rootDir, file), 'utf8');
  const matches = source.matchAll(
    /(?:import|export)\s+(?:type\s+)?(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g
  );

  return [...matches].map((match) => match[1] ?? '');
}

describe('workspace import boundaries', () => {
  it('has explicit frontend, backend, and shared package roots', () => {
    expect(existsSync(path.join(rootDir, 'packages/frontend'))).toBe(true);
    expect(existsSync(path.join(rootDir, 'packages/backend'))).toBe(true);
    expect(existsSync(path.join(rootDir, 'packages/shared'))).toBe(true);
  });

  it('keeps frontend from importing backend internals', () => {
    const offenders = listTrackedSourceFiles()
      .filter((file) => file.startsWith('packages/frontend/'))
      .flatMap((file) =>
        importsIn(file)
          .filter(
            (specifier) =>
              specifier === '@story-weaver/backend' ||
              specifier.startsWith('@story-weaver/backend/') ||
              specifier.includes('/packages/backend/') ||
              specifier.includes('../../backend/')
          )
          .map((specifier) => `${file} -> ${specifier}`)
      );

    expect(offenders).toEqual([]);
  });

  it('keeps shared runtime neutral', () => {
    const forbidden = [
      '@story-weaver/backend',
      '@story-weaver/frontend',
      'node:',
      'better-sqlite3',
      'electron',
      'fastify',
      'react',
    ];
    const offenders = listTrackedSourceFiles()
      .filter((file) => file.startsWith('packages/shared/'))
      .flatMap((file) =>
        importsIn(file)
          .filter((specifier) =>
            forbidden.some(
              (blocked) =>
                specifier === blocked || specifier.startsWith(`${blocked}/`)
            )
          )
          .map((specifier) => `${file} -> ${specifier}`)
      );

    expect(offenders).toEqual([]);
  });

  it('keeps backend from importing frontend', () => {
    const offenders = listTrackedSourceFiles()
      .filter((file) => file.startsWith('packages/backend/'))
      .flatMap((file) =>
        importsIn(file)
          .filter(
            (specifier) =>
              specifier === '@story-weaver/frontend' ||
              specifier.startsWith('@story-weaver/frontend/') ||
              specifier.includes('/packages/frontend/') ||
              specifier.includes('../../frontend/')
          )
          .map((specifier) => `${file} -> ${specifier}`)
      );

    expect(offenders).toEqual([]);
  });

  it('keeps electron from importing frontend source files', () => {
    const offenders = listTrackedSourceFiles()
      .filter((file) => file.startsWith('electron/'))
      .flatMap((file) =>
        importsIn(file)
          .filter(
            (specifier) =>
              specifier === '@story-weaver/frontend' ||
              specifier.startsWith('@story-weaver/frontend/') ||
              specifier.includes('/packages/frontend/src') ||
              specifier.includes('../packages/frontend/src')
          )
          .map((specifier) => `${file} -> ${specifier}`)
      );

    expect(offenders).toEqual([]);
  });

  it('does not keep application source in legacy root directories', () => {
    const legacySources = listTrackedSourceFiles().filter(
      (file) =>
        file.startsWith('src/') ||
        file.startsWith('server/') ||
        file.startsWith('renderer/')
    );

    expect(legacySources).toEqual([]);
  });

  it('keeps executable code and tests free of legacy business IPC channel strings', () => {
    const channelPattern = /['"`](?:book|scheduler|model|settings|logs):[a-zA-Z]/;
    const offenders = listTrackedSourceFiles()
      .filter((file) => !file.includes('/dist/'))
      .filter((file) =>
        channelPattern.test(readFileSync(path.join(rootDir, file), 'utf8'))
      );

    expect(offenders).toEqual([]);
  });
});
