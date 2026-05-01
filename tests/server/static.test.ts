import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildServer } from '@story-weaver/backend';

const roots: string[] = [];

function makeTempDir(prefix: string) {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), prefix));
  roots.push(rootDir);
  return rootDir;
}

describe('server static frontend routes', () => {
  afterEach(() => {
    for (const rootDir of roots.splice(0)) {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('serves the built renderer index from Fastify', async () => {
    const staticDir = makeTempDir('story-weaver-static-');
    writeFileSync(
      path.join(staticDir, 'index.html'),
      '<!doctype html><title>Story Weaver Browser</title>',
      'utf8'
    );
    const server = await buildServer({
      rootDir: makeTempDir('story-weaver-static-root-'),
      staticDir,
    });

    try {
      const response = await server.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.payload).toContain('Story Weaver Browser');
    } finally {
      await server.close();
    }
  });

  it('falls back to index.html for browser routes without swallowing API 404s', async () => {
    const staticDir = makeTempDir('story-weaver-static-');
    writeFileSync(
      path.join(staticDir, 'index.html'),
      '<!doctype html><title>Story Weaver SPA</title>',
      'utf8'
    );
    const server = await buildServer({
      rootDir: makeTempDir('story-weaver-static-root-'),
      staticDir,
    });

    try {
      const browserRoute = await server.inject({
        method: 'GET',
        url: '/books/book-1',
      });
      const apiRoute = await server.inject({
        method: 'GET',
        url: '/api/missing',
      });

      expect(browserRoute.statusCode).toBe(200);
      expect(browserRoute.payload).toContain('Story Weaver SPA');
      expect(apiRoute.statusCode).toBe(404);
    } finally {
      await server.close();
    }
  });

  it('keeps health available when static serving is enabled', async () => {
    const staticDir = makeTempDir('story-weaver-static-');
    writeFileSync(
      path.join(staticDir, 'index.html'),
      '<!doctype html><title>Story Weaver SPA</title>',
      'utf8'
    );
    const server = await buildServer({
      rootDir: makeTempDir('story-weaver-static-root-'),
      staticDir,
    });

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
});
