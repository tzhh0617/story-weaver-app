import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

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
const electronTsConfigSource = fs.readFileSync(
  path.resolve(__dirname, '../../tsconfig.node.json'),
  'utf8'
);
const iconGenerationSource = fs.readFileSync(
  path.resolve(__dirname, '../../scripts/generate-icons.py'),
  'utf8'
);

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
});
