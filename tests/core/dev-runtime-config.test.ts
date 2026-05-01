import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ipcInvokeChannels } from '../../src/shared/contracts';

const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')
) as {
  scripts?: Record<string, string>;
};
const viteConfigSource = fs.readFileSync(
  path.resolve(__dirname, '../../vite.config.ts'),
  'utf8'
);
const electronMainSource = fs.readFileSync(
  path.resolve(__dirname, '../../electron/main.ts'),
  'utf8'
);
const electronPreloadSource = fs.readFileSync(
  path.resolve(__dirname, '../../electron/preload.cts'),
  'utf8'
);
const electronTsConfigSource = fs.readFileSync(
  path.resolve(__dirname, '../../tsconfig.node.json'),
  'utf8'
);
const electronBuilderConfigSource = fs.readFileSync(
  path.resolve(__dirname, '../../electron-builder.yml'),
  'utf8'
);
const iconGenerationSource = fs.readFileSync(
  path.resolve(__dirname, '../../scripts/generate-icons.py'),
  'utf8'
);
const browserPersistenceSmokeSource = fs.existsSync(
  path.resolve(__dirname, '../../scripts/smoke-browser-persistence.mjs')
)
  ? fs.readFileSync(
      path.resolve(__dirname, '../../scripts/smoke-browser-persistence.mjs'),
      'utf8'
    )
  : '';

describe('desktop runtime config', () => {
  it('builds renderer assets with a relative base for file:// loading', () => {
    expect(viteConfigSource).toContain("base: './'");
  });

  it('passes the Vite dev server URL into Electron during development', () => {
    expect(packageJson.scripts?.['dev:electron']).toContain(
      'VITE_DEV_SERVER_URL=http://localhost:5173'
    );
  });

  it('builds the Electron preload before launching the dev shell', () => {
    expect(packageJson.scripts?.['dev:electron']).toContain(
      'pnpm run build:electron'
    );
  });

  it('loads the preload bridge as a CommonJS script', () => {
    expect(electronMainSource).toContain(
      "'dist-electron/electron/preload.cjs'"
    );
    expect(electronTsConfigSource).toContain('"electron/**/*.cts"');
  });

  it('restricts renderer invoke calls to explicit IPC channels in preload', () => {
    expect(electronPreloadSource).toContain('allowedInvokeChannels');
    expect(electronPreloadSource).toContain("'book:list'");
    expect(electronPreloadSource).toContain("'settings:set'");
    expect(electronPreloadSource).toContain('Unsupported IPC channel');
  });

  it('keeps the preload invoke whitelist aligned with shared IPC contracts', () => {
    const match = electronPreloadSource.match(
      /allowedInvokeChannels = new Set\(\[([\s\S]*?)\]\)/
    );
    expect(match?.[1]).toBeTruthy();

    const preloadChannels = Array.from(
      match?.[1].matchAll(/'([^']+)'/g) ?? [],
      (channelMatch) => channelMatch[1]
    ).sort();

    expect(preloadChannels).toEqual([...ipcInvokeChannels].sort());
  });

  it('uses the generated icon for the macOS development dock', () => {
    expect(electronMainSource).toContain('nativeImage');
    expect(electronMainSource).toContain("'build/icon.png'");
    expect(electronMainSource).toContain('app.dock.setIcon');
  });

  it('generates desktop icons with a transparent outer margin and themed backdrop', () => {
    expect(iconGenerationSource).toContain('BACKGROUND_SIZE = 768');
    expect(iconGenerationSource).toContain('ICON_BACKGROUND = (239, 230, 213, 255)');
    expect(iconGenerationSource).toContain('rounded_rectangle');
    expect(iconGenerationSource).toContain('(0, 0, 0, 0)');
  });

  it('keeps desktop icon artwork inset within the transparent canvas', () => {
    expect(iconGenerationSource).toContain('CONTENT_SIZE = 704');
  });

  it('keeps the renderer dev server pinned to port 5173', () => {
    expect(packageJson.scripts?.['dev:renderer']).toBe('vite --strictPort');
  });

  it('does not force a native rebuild during installation', () => {
    expect(packageJson.scripts?.['rebuild:native']).toBeUndefined();
    expect(packageJson.scripts?.postinstall).toBeUndefined();
  });

  it('packages database migration files with the Electron app', () => {
    expect(electronBuilderConfigSource).toContain('drizzle/**');
  });

  it('provides an automated browser persistence smoke check', () => {
    expect(packageJson.scripts?.['smoke:browser-persistence']).toBe(
      'node scripts/smoke-browser-persistence.mjs'
    );
    expect(browserPersistenceSmokeSource).toContain('STORY_WEAVER_ROOT_DIR');
    expect(browserPersistenceSmokeSource).toContain('/api/invoke');
    expect(browserPersistenceSmokeSource).toContain('better-sqlite3');
    expect(browserPersistenceSmokeSource).toContain(
      "['rebuild', 'better-sqlite3']"
    );
  });

  it('rebuilds native SQLite bindings for Node before browser server startup', () => {
    expect(packageJson.scripts?.['dev:server']).toBe(
      'pnpm rebuild better-sqlite3 && tsx server/main.ts'
    );
    expect(packageJson.scripts?.['start:server']).toBe(
      'pnpm rebuild better-sqlite3 && node dist-server/server/main.js'
    );
  });
});
