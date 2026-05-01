import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildServer } from '@story-weaver/backend';

const roots: string[] = [];

function makeRootDir() {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), 'story-weaver-scheduler-api-'));
  roots.push(rootDir);
  return rootDir;
}

describe('server scheduler routes', () => {
  afterEach(() => {
    for (const rootDir of roots.splice(0)) {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('returns scheduler status and accepts start and pause commands', async () => {
    const server = await buildServer({ rootDir: makeRootDir() });

    try {
      const status = await server.inject({
        method: 'GET',
        url: '/api/scheduler/status',
      });
      expect(status.statusCode).toBe(200);
      expect(status.json()).toEqual(
        expect.objectContaining({
          runningBookIds: [],
          queuedBookIds: [],
          pausedBookIds: [],
        })
      );

      const start = await server.inject({
        method: 'POST',
        url: '/api/scheduler/start',
      });
      expect(start.statusCode).toBe(200);
      expect(start.json()).toEqual({ ok: true });

      const pause = await server.inject({
        method: 'POST',
        url: '/api/scheduler/pause',
      });
      expect(pause.statusCode).toBe(200);
      expect(pause.json()).toEqual({ ok: true });
    } finally {
      await server.close();
    }
  });
});
