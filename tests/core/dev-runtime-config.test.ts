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
const electronRuntimeAiServicesSource = fs.readFileSync(
  path.resolve(__dirname, '../../electron/runtime-ai-services.ts'),
  'utf8'
);
const electronRuntimeEnvSource = fs.readFileSync(
  path.resolve(__dirname, '../../electron/runtime-env.ts'),
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
const iconGenerationSource = fs.readFileSync(
  path.resolve(__dirname, '../../scripts/generate-icons.py'),
  'utf8'
);
const gitignoreSource = fs.readFileSync(
  path.resolve(__dirname, '../../.gitignore'),
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

  it('starts development through turbo without using the background daemon', () => {
    expect(packageJson.scripts?.dev).toBe(
      'turbo run dev:renderer dev:electron'
    );
    expect(packageJson.scripts?.dev).not.toContain('--no-daemon');
    expect(packageJson.scripts?.dev).not.toContain('--daemon');
  });

  it('does not use concurrently for development startup', () => {
    expect(packageJson.scripts?.dev).not.toContain('concurrently');
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

  it('loads runtime environment values from .env.local before process env', () => {
    expect(electronRuntimeEnvSource).toContain("'.env.local'");
    expect(electronRuntimeAiServicesSource).toContain('runtimeConfig');
    expect(electronRuntimeAiServicesSource).not.toContain('process.env.STORY_WEAVER');
  });

  it('keeps local environment overrides out of git', () => {
    expect(gitignoreSource).toContain('.env.local');
  });
});
