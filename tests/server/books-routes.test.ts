import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildServer } from '@story-weaver/backend';
import { createRuntimeServices } from '@story-weaver/backend/runtime/create-runtime-services';

const roots: string[] = [];

function makeRootDir() {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), 'story-weaver-books-api-'));
  roots.push(rootDir);
  return rootDir;
}

describe('server book routes', () => {
  afterEach(() => {
    for (const rootDir of roots.splice(0)) {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('creates, lists, reads, and deletes a book through concrete routes', async () => {
    const server = await buildServer({ rootDir: makeRootDir() });

    try {
      const create = await server.inject({
        method: 'POST',
        url: '/api/books',
        payload: {
          idea: 'A city that stores memory in rain.',
          targetChapters: 1,
          wordsPerChapter: 1200,
        },
      });

      expect(create.statusCode).toBe(200);
      expect(create.json()).toEqual({ bookId: expect.any(String) });

      const bookId = create.json().bookId as string;
      const list = await server.inject({ method: 'GET', url: '/api/books' });
      expect(list.statusCode).toBe(200);
      expect(list.json()).toEqual([
        expect.objectContaining({
          id: bookId,
          idea: 'A city that stores memory in rain.',
        }),
      ]);

      const detail = await server.inject({
        method: 'GET',
        url: `/api/books/${bookId}`,
      });
      expect(detail.statusCode).toBe(200);
      expect(detail.json()).toEqual(
        expect.objectContaining({
          book: expect.objectContaining({ id: bookId }),
        })
      );

      const deletion = await server.inject({
        method: 'DELETE',
        url: `/api/books/${bookId}`,
      });
      expect(deletion.statusCode).toBe(200);
      expect(deletion.json()).toEqual({ ok: true });
    } finally {
      await server.close();
    }
  });

  it('rejects invalid create payloads through concrete routes', async () => {
    const server = await buildServer({ rootDir: makeRootDir() });

    try {
      const response = await server.inject({
        method: 'POST',
        url: '/api/books',
        payload: {
          idea: '旧案复仇',
          targetChapters: 500,
          wordsPerChapter: 2500,
          viralStrategy: {
            readerPayoff: 'revenge',
            tropeContracts: ['revenge_payback'],
            cadenceMode: 'not-a-mode',
          },
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: {
          code: 'VALIDATION_ERROR',
          message: expect.any(String),
          details: expect.any(Array),
        },
      });
    } finally {
      await server.close();
    }
  });

  it('exposes lifecycle and chapter writing actions as concrete routes', async () => {
    const startBook = vi.fn(async () => undefined);
    const pauseBook = vi.fn();
    const resumeBook = vi.fn(async () => undefined);
    const restartBook = vi.fn(async () => undefined);
    const writeNextChapter = vi.fn(async () => ({ chapterIndex: 1 }));
    const writeRemainingChapters = vi.fn(async () => ({
      completedChapters: 1,
      status: 'completed' as const,
    }));
    const server = await buildServer({
      rootDir: makeRootDir(),
      createRuntime: (input) => ({
        ...createRuntimeServices(input),
        startBook,
        pauseBook,
        resumeBook,
        restartBook,
        writeNextChapter,
        writeRemainingChapters,
      }),
    });

    try {
      const bookId = 'book-1';
      const start = await server.inject({
        method: 'POST',
        url: `/api/books/${bookId}/start`,
      });
      expect(start.statusCode).toBe(200);
      expect(start.json()).toEqual({ ok: true });
      expect(startBook).toHaveBeenCalledWith(bookId);

      const pause = await server.inject({
        method: 'POST',
        url: `/api/books/${bookId}/pause`,
      });
      expect(pause.statusCode).toBe(200);
      expect(pause.json()).toEqual({ ok: true });
      expect(pauseBook).toHaveBeenCalledWith(bookId);

      const resume = await server.inject({
        method: 'POST',
        url: `/api/books/${bookId}/resume`,
      });
      expect(resume.statusCode).toBe(200);
      expect(resume.json()).toEqual({ ok: true });
      expect(resumeBook).toHaveBeenCalledWith(bookId);

      const restart = await server.inject({
        method: 'POST',
        url: `/api/books/${bookId}/restart`,
      });
      expect(restart.statusCode).toBe(200);
      expect(restart.json()).toEqual({ ok: true });
      expect(restartBook).toHaveBeenCalledWith(bookId);

      const writeNext = await server.inject({
        method: 'POST',
        url: `/api/books/${bookId}/chapters/write-next`,
      });
      expect(writeNext.statusCode).toBe(200);
      expect(writeNext.json()).toEqual({ chapterIndex: 1 });
      expect(writeNextChapter).toHaveBeenCalledWith(bookId);

      const writeAll = await server.inject({
        method: 'POST',
        url: `/api/books/${bookId}/chapters/write-all`,
      });
      expect(writeAll.statusCode).toBe(200);
      expect(writeAll.json()).toEqual({
        completedChapters: 1,
        status: 'completed',
      });
      expect(writeRemainingChapters).toHaveBeenCalledWith(bookId);
    } finally {
      await server.close();
    }
  });
});
