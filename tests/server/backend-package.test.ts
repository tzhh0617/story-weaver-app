import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { buildServer } from '@story-weaver/backend';

const rootDir = path.resolve(__dirname, '../..');

describe('backend package entry', () => {
  it('exports the Fastify server builder', async () => {
    const server = await buildServer();

    try {
      const response = await server.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ ok: true });
    } finally {
      await server.close();
    }
  });

  it('does not export removed mock runtime internals', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(
        path.join(rootDir, 'packages/backend/package.json'),
        'utf8'
      )
    ) as { exports?: Record<string, unknown> };

    expect(packageJson.exports?.['./mock/*']).toBeUndefined();
    expect(fs.existsSync(path.join(rootDir, 'packages/backend/src/mock'))).toBe(
      false
    );
  });

  it('can load backend source through the development tsx config', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(
        path.join(rootDir, 'packages/backend/package.json'),
        'utf8'
      )
    ) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.dev).toContain('--tsconfig tsconfig.dev.json');

    const output = execFileSync(
      'pnpm',
      [
        'exec',
        'tsx',
        '--tsconfig',
        'packages/backend/tsconfig.dev.json',
        'tests/fixtures/backend-dev-import.ts',
      ],
      {
        cwd: rootDir,
        encoding: 'utf8',
      }
    );

    expect(output.trim()).toBe('generation.shortChapterReview.enabled');
  });
});
