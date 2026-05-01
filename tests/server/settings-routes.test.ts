import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SHORT_CHAPTER_REVIEW_ENABLED_KEY } from '../../src/core/chapter-review';
import { buildServer } from '../../server/main';

const roots: string[] = [];

function makeRootDir() {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), 'story-weaver-settings-api-'));
  roots.push(rootDir);
  return rootDir;
}

describe('server settings routes', () => {
  afterEach(() => {
    for (const rootDir of roots.splice(0)) {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('lists, reads, and writes settings through concrete routes', async () => {
    const server = await buildServer({ rootDir: makeRootDir() });

    try {
      const save = await server.inject({
        method: 'PUT',
        url: '/api/settings/scheduler.concurrencyLimit',
        payload: { value: '2' },
      });
      expect(save.statusCode).toBe(200);
      expect(save.json()).toEqual({ ok: true });

      const read = await server.inject({
        method: 'GET',
        url: '/api/settings/scheduler.concurrencyLimit',
      });
      expect(read.statusCode).toBe(200);
      expect(read.json()).toEqual({
        key: 'scheduler.concurrencyLimit',
        value: '2',
      });

      const list = await server.inject({
        method: 'GET',
        url: '/api/settings',
      });
      expect(list.statusCode).toBe(200);
      expect(list.json()).toEqual(
        expect.arrayContaining([
          { key: 'scheduler.concurrencyLimit', value: '2' },
        ])
      );
    } finally {
      await server.close();
    }
  });

  it('keeps existing settings validation behavior', async () => {
    const server = await buildServer({ rootDir: makeRootDir() });

    try {
      const invalidConcurrency = await server.inject({
        method: 'PUT',
        url: '/api/settings/scheduler.concurrencyLimit',
        payload: { value: '0' },
      });
      expect(invalidConcurrency.statusCode).toBe(400);
      expect(invalidConcurrency.json()).toEqual({
        error: 'Concurrency limit must be a positive integer',
      });

      const invalidReview = await server.inject({
        method: 'PUT',
        url: `/api/settings/${encodeURIComponent(SHORT_CHAPTER_REVIEW_ENABLED_KEY)}`,
        payload: { value: 'sometimes' },
      });
      expect(invalidReview.statusCode).toBe(400);
      expect(invalidReview.json()).toEqual({
        error: 'Short chapter review setting must be true or false',
      });
    } finally {
      await server.close();
    }
  });
});
