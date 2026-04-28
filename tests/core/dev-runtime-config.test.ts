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

describe('desktop runtime config', () => {
  it('builds renderer assets with a relative base for file:// loading', () => {
    expect(viteConfigSource).toContain("base: './'");
  });

  it('passes the Vite dev server URL into Electron during development', () => {
    expect(packageJson.scripts?.['dev:electron']).toContain(
      'VITE_DEV_SERVER_URL=http://localhost:5173'
    );
  });

  it('keeps the renderer dev server pinned to port 5173', () => {
    expect(packageJson.scripts?.['dev:renderer']).toBe('vite --strictPort');
  });

  it('does not force a native rebuild during installation', () => {
    expect(packageJson.scripts?.['rebuild:native']).toBeUndefined();
    expect(packageJson.scripts?.postinstall).toBeUndefined();
  });
});
