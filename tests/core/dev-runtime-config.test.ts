import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')
) as {
  scripts?: Record<string, string>;
};
const viteConfigSource = fs.readFileSync(
  path.resolve(__dirname, '../../packages/frontend/vite.config.ts'),
  'utf8'
);
const electronMainSource = fs.readFileSync(
  path.resolve(__dirname, '../../electron/main.ts'),
  'utf8'
);
const electronTsConfigSource = fs.readFileSync(
  path.resolve(__dirname, '../../tsconfig.node.json'),
  'utf8'
);
const serverTsConfigSource = fs.readFileSync(
  path.resolve(__dirname, '../../tsconfig.server.json'),
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
const electronPackageSmokeSource = fs.existsSync(
  path.resolve(__dirname, '../../scripts/smoke-electron-package.mjs')
)
  ? fs.readFileSync(
      path.resolve(__dirname, '../../scripts/smoke-electron-package.mjs'),
      'utf8'
    )
  : '';

describe('desktop runtime config', () => {
  it('builds renderer assets with root-relative URLs for server-backed SPA routes', () => {
    expect(viteConfigSource).toContain("base: '/'");
    expect(viteConfigSource).not.toContain("base: './'");
  });

  it('passes the Vite dev server URL into Electron during development', () => {
    expect(packageJson.scripts?.['dev:electron']).toContain(
      'VITE_DEV_SERVER_URL=http://localhost:5173'
    );
  });

  it('builds the Electron shell before launching the dev shell', () => {
    expect(packageJson.scripts?.['dev:electron']).toContain(
      'pnpm run build:electron'
    );
  });

  it('does not register Electron business IPC handlers', () => {
    expect(electronMainSource).not.toContain('registerBookHandlers');
    expect(electronMainSource).not.toContain('registerSchedulerHandlers');
    expect(electronMainSource).not.toContain('registerModelHandlers');
    expect(electronMainSource).not.toContain('registerSettingsHandlers');
    expect(electronMainSource).not.toContain('registerLogHandlers');
    expect(electronMainSource).not.toContain('preload:');
    expect(electronTsConfigSource).not.toContain('"electron/**/*.cts"');
  });

  it('loads the renderer through a local server URL', () => {
    expect(electronMainSource).toContain('startServer');
    expect(electronMainSource).toContain('storyWeaverApi');
    expect(electronMainSource).toContain('mainWindow.loadURL');
  });

  it('serves packaged renderer assets from the Electron app path', () => {
    expect(electronMainSource).toContain('staticDir');
    expect(electronMainSource).toContain(
      "path.join(app.getAppPath(), 'packages/frontend/dist')"
    );
  });

  it('starts the Electron-owned server on an available local port', () => {
    expect(electronMainSource).toContain('port: 0');
  });

  it('packages compiled server files with the Electron app', () => {
    expect(electronBuilderConfigSource).toContain('packages/backend/dist/**');
  });

  it('removes obsolete command bus source files', () => {
    expect(
      fs.existsSync(path.resolve(__dirname, '../../server/routes/invoke.ts'))
    ).toBe(false);
    expect(
      fs.existsSync(path.resolve(__dirname, '../../server/channel-dispatch.ts'))
    ).toBe(false);
    expect(
      fs.existsSync(path.resolve(__dirname, '../../electron/preload.cts'))
    ).toBe(false);
  });

  it('keeps the server build free of Electron runtime wrappers', () => {
    expect(serverTsConfigSource).not.toContain('electron/runtime.ts');
    expect(serverTsConfigSource).not.toContain('electron/runtime-ai-services.ts');
    expect(fs.existsSync(path.resolve(__dirname, '../../electron/runtime.ts'))).toBe(
      false
    );
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
    expect(packageJson.scripts?.['dev:frontend']).toBe(
      'pnpm --filter @story-weaver/frontend dev'
    );
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
    expect(browserPersistenceSmokeSource).toContain("method: 'POST'");
    expect(browserPersistenceSmokeSource).toContain('/api/books');
    expect(browserPersistenceSmokeSource).not.toContain('/api/invoke');
    expect(browserPersistenceSmokeSource).toContain('better-sqlite3');
    expect(browserPersistenceSmokeSource).toContain(
      "['rebuild', 'better-sqlite3']"
    );
  });

  it('rebuilds native SQLite bindings for Node before browser server startup', () => {
    expect(packageJson.scripts?.['dev:backend']).toBe(
      'pnpm --filter @story-weaver/backend dev'
    );
    expect(packageJson.scripts?.['start:server']).toBe(
      'pnpm --filter @story-weaver/backend start'
    );
  });

  it('provides an automated Electron package smoke check', () => {
    expect(packageJson.scripts?.['smoke:electron-package']).toBe(
      'node scripts/smoke-electron-package.mjs'
    );
    expect(electronPackageSmokeSource).toContain('/tmp/story-weaver-package-smoke');
    expect(electronPackageSmokeSource).toContain('electron-builder');
    expect(electronPackageSmokeSource).toContain('/drizzle/meta/_journal.json');
    expect(electronPackageSmokeSource).toContain('/dist-electron/');
    expect(electronPackageSmokeSource).toContain(
      '/packages/frontend/dist/index.html'
    );
    expect(electronPackageSmokeSource).toContain('/packages/backend/dist/');
    expect(electronPackageSmokeSource).toContain('/packages/shared/dist/');
    expect(electronPackageSmokeSource).toContain('better_sqlite3.node');
  });
});
