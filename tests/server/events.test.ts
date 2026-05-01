import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildServer } from '../../server/main';

const roots: string[] = [];

function makeRootDir() {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), 'story-weaver-events-'));
  roots.push(rootDir);
  return rootDir;
}

describe('server event routes', () => {
  afterEach(() => {
    for (const rootDir of roots.splice(0)) {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('streams the current scheduler status as an SSE frame', async () => {
    const server = await buildServer({ rootDir: makeRootDir() });

    try {
      const response = await server.inject({
        method: 'GET',
        url: '/api/events/scheduler?once=1',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/event-stream');
      expect(response.payload).toContain('data:');
      expect(response.payload).toContain('"runningBookIds":[]');
    } finally {
      await server.close();
    }
  });
});
