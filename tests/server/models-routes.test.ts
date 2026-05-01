import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildServer } from '../../server/main';
import { createRuntimeServices } from '../../src/runtime/create-runtime-services';

const roots: string[] = [];

function makeRootDir() {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), 'story-weaver-models-api-'));
  roots.push(rootDir);
  return rootDir;
}

describe('server model routes', () => {
  afterEach(() => {
    for (const rootDir of roots.splice(0)) {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('lists, saves, and tests model configs through concrete routes', async () => {
    const testModel = vi.fn(async () => ({
      ok: true,
      latency: 42,
      error: null,
    }));
    const server = await buildServer({
      rootDir: makeRootDir(),
      createRuntime: (input) => ({
        ...createRuntimeServices(input),
        testModel,
      }),
    });

    try {
      const input = {
        id: 'model-1',
        provider: 'openai',
        modelName: 'gpt-test',
        apiKey: 'test-key',
        baseUrl: 'https://example.test/v1',
        config: {},
      };

      const save = await server.inject({
        method: 'PUT',
        url: '/api/models/model-1',
        payload: input,
      });
      expect(save.statusCode).toBe(200);
      expect(save.json()).toEqual({ ok: true });

      const list = await server.inject({
        method: 'GET',
        url: '/api/models',
      });
      expect(list.statusCode).toBe(200);
      expect(list.json()).toEqual([input]);

      const test = await server.inject({
        method: 'POST',
        url: '/api/models/model-1/test',
      });
      expect(test.statusCode).toBe(200);
      expect(test.json()).toEqual({ ok: true, latency: 42, error: null });
      expect(testModel).toHaveBeenCalledWith('model-1');

      const mismatch = await server.inject({
        method: 'PUT',
        url: '/api/models/model-2',
        payload: input,
      });
      expect(mismatch.statusCode).toBe(400);
      expect(mismatch.json()).toEqual({ error: 'Model id does not match route' });
    } finally {
      await server.close();
    }
  });
});
