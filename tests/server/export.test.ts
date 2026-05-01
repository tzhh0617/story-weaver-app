import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildServer } from '../../server/main';

const roots: string[] = [];

function makeRootDir() {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), 'story-weaver-export-server-'));
  roots.push(rootDir);
  return rootDir;
}

describe('server export route', () => {
  afterEach(() => {
    for (const rootDir of roots.splice(0)) {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('returns a browser download URL for exported books and serves the file', async () => {
    const server = await buildServer({ rootDir: makeRootDir() });

    try {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/books',
        payload: {
          idea: 'A city remembers every exported chapter.',
          targetChapters: 1,
          wordsPerChapter: 1200,
        },
      });
      const bookId = createResponse.json().bookId as string;

      const exportResponse = await server.inject({
        method: 'POST',
        url: `/api/books/${bookId}/exports`,
        payload: { format: 'txt' },
      });

      expect(exportResponse.statusCode).toBe(200);
      expect(exportResponse.json()).toMatchObject({
        filePath: expect.stringMatching(/\.txt$/),
        downloadUrl: expect.stringMatching(/^\/api\/exports\//),
      });

      const downloadResponse = await server.inject({
        method: 'GET',
        url: exportResponse.json().downloadUrl,
      });

      expect(downloadResponse.statusCode).toBe(200);
      expect(downloadResponse.headers['content-disposition']).toContain(
        'attachment'
      );
      expect(downloadResponse.payload).toContain('新作品');
    } finally {
      await server.close();
    }
  });
});
