import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildServer } from '../../server/main';
import { createRuntimeServices } from '../../src/runtime/create-runtime-services';

const roots: string[] = [];

function makeRootDir() {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), 'story-weaver-server-'));
  roots.push(rootDir);
  return rootDir;
}

describe('server invoke route', () => {
  afterEach(() => {
    for (const rootDir of roots.splice(0)) {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('dispatches book:list through the shared runtime', async () => {
    const server = await buildServer({ rootDir: makeRootDir() });

    try {
      const response = await server.inject({
        method: 'POST',
        url: '/api/invoke',
        payload: { channel: 'book:list' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ data: [] });
    } finally {
      await server.close();
    }
  });

  it('rejects invalid channel payloads with a 400 response', async () => {
    const server = await buildServer({ rootDir: makeRootDir() });

    try {
      const response = await server.inject({
        method: 'POST',
        url: '/api/invoke',
        payload: {
          channel: 'book:detail',
          payload: { missingBookId: true },
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: 'Invalid payload for book:detail',
      });
    } finally {
      await server.close();
    }
  });

  it('closes the shared runtime when the Fastify server closes', async () => {
    const close = vi.fn();
    const server = await buildServer({
      rootDir: makeRootDir(),
      createRuntime: (input) => ({
        ...createRuntimeServices(input),
        close,
      }),
    });

    await server.close();

    expect(close).toHaveBeenCalledTimes(1);
  });
});
