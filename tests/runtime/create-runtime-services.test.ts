import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRuntimeServices } from '@story-weaver/backend/runtime/create-runtime-services';

async function waitForBookStatus(
  services: ReturnType<typeof createRuntimeServices>,
  bookId: string,
  status: string
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 5000) {
    const detail = services.bookService.getBookDetail(bookId);
    if (detail?.book.status === status) {
      return detail;
    }

    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error(`Timed out waiting for ${status}`);
}

describe('createRuntimeServices', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('boots against an isolated root directory with real repositories', () => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), 'story-weaver-runtime-'));

    try {
      const services = createRuntimeServices({ rootDir });

      services.settings.set('runtime.test', 'ok');

      expect(services.bookService.listBooks()).toEqual([]);
      expect(services.settings.get('runtime.test')).toBe('ok');
      services.close();
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('closes the underlying database connection idempotently', () => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), 'story-weaver-runtime-'));

    try {
      const services = createRuntimeServices({ rootDir });

      services.close();
      expect(() => services.close()).not.toThrow();
      expect(() => services.bookService.listBooks()).toThrow();
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('resumes paused books through the background scheduler', async () => {
    vi.stubEnv('STORY_WEAVER_DISABLE_LOCAL_ENV', '1');
    vi.stubEnv('STORY_WEAVER_MOCK_DELAY_MS', '80');
    vi.stubEnv('STORY_WEAVER_MOCK_STREAM_TOKENS_PER_SECOND', '300000');
    const rootDir = mkdtempSync(path.join(os.tmpdir(), 'story-weaver-runtime-'));
    const services = createRuntimeServices({ rootDir });

    try {
      const bookId = services.bookService.createBook({
        idea: '一个被宗门逐出的少年，意外继承了会吞噬因果的古镜。',
        targetChapters: 3,
        wordsPerChapter: 90,
      });

      await services.bookService.startBook(bookId);
      services.pauseBook(bookId);
      await services.resumeBook(bookId);

      expect(services.getSchedulerStatus().runningBookIds).toContain(bookId);

      const detail = await waitForBookStatus(services, bookId, 'completed');
      expect(detail?.chapters.filter((chapter) => chapter.content)).toHaveLength(3);
    } finally {
      services.close();
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('keeps shared runtime composition independent from electron modules', () => {
    const runtimeSource = readFileSync(
      path.resolve('packages/backend/src/runtime/create-runtime-services.ts'),
      'utf8'
    );

    expect(runtimeSource).not.toContain('../../electron');
    expect(runtimeSource).not.toContain('../electron');
  });
});
