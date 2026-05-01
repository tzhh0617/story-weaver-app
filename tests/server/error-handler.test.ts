import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildServer } from '@story-weaver/backend';

const roots: string[] = [];

function makeRootDir() {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), 'story-weaver-error-handler-'));
  roots.push(rootDir);
  return rootDir;
}

describe('global error handler', () => {
  afterEach(() => {
    for (const rootDir of roots.splice(0)) {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('returns 404 for unknown API routes', async () => {
    const server = await buildServer({ rootDir: makeRootDir() });
    try {
      const response = await server.inject({
        method: 'GET',
        url: '/api/nonexistent',
      });
      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error.code).toBe('NOT_FOUND');
    } finally {
      await server.close();
    }
  });

  it('returns 400 with VALIDATION_ERROR for invalid book create payload', async () => {
    const server = await buildServer({ rootDir: makeRootDir() });
    try {
      const response = await server.inject({
        method: 'POST',
        url: '/api/books',
        payload: { idea: 123 },
      });
      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details).toBeDefined();
    } finally {
      await server.close();
    }
  });
});
