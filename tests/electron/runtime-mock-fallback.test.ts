import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_MOCK_MODEL_ID } from '../../src/models/runtime-mode';
import { countStoryCharacters } from '../../src/core/story-constraints';

function makeTempHome(testName: string) {
  return path.resolve(
    process.cwd(),
    '.tmp-tests',
    `runtime-${testName}-${Date.now()}`
  );
}

async function loadRuntimeServices(input: {
  tempHome: string;
  generateTextImpl: ReturnType<typeof vi.fn>;
  mockDelayMs?: number;
  mockStreamTokensPerSecond?: number | null;
}) {
  vi.resetModules();
  if (input.mockDelayMs === undefined) {
    delete process.env.STORY_WEAVER_MOCK_DELAY_MS;
  } else {
    process.env.STORY_WEAVER_MOCK_DELAY_MS = String(input.mockDelayMs);
  }
  if (input.mockStreamTokensPerSecond === null) {
    delete process.env.STORY_WEAVER_MOCK_STREAM_TOKENS_PER_SECOND;
  } else {
    process.env.STORY_WEAVER_MOCK_STREAM_TOKENS_PER_SECOND = String(
      input.mockStreamTokensPerSecond ?? 300_000
    );
  }
  vi.doMock('node:os', () => ({
    default: {
      homedir: () => input.tempHome,
    },
  }));
  vi.doMock('ai', async (importOriginal) => {
    const actual = await importOriginal<typeof import('ai')>();
    return {
      ...actual,
      generateText: input.generateTextImpl,
    };
  });

  const runtimeModule = await import('../../electron/runtime');
  return runtimeModule.getRuntimeServices();
}

async function waitForBookStatus(
  services: Awaited<ReturnType<typeof loadRuntimeServices>>,
  bookId: string,
  status: string
) {
  const deadline = Date.now() + 2000;

  while (Date.now() < deadline) {
    const detail = services.bookService.getBookDetail(bookId);
    if (detail?.book.status === status) {
      return detail;
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  return services.bookService.getBookDetail(bookId);
}

describe('runtime mock fallback', () => {
  let tempHome = '';

  beforeEach(() => {
    tempHome = makeTempHome('case');
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  afterEach(() => {
    vi.doUnmock('node:os');
    vi.doUnmock('ai');
    delete process.env.STORY_WEAVER_MOCK_DELAY_MS;
    delete process.env.STORY_WEAVER_MOCK_STREAM_TOKENS_PER_SECOND;
    vi.useRealTimers();
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  it('uses Chinese mock story services when no complete model config exists', async () => {
    const generateText = vi.fn().mockResolvedValue({
      text: 'should not be used',
    });
    const services = await loadRuntimeServices({
      tempHome,
      generateTextImpl: generateText,
      mockDelayMs: 0,
    });

    const bookId = services.bookService.createBook({
      idea: '一个被宗门逐出的少年，意外继承了会吞噬因果的古镜。',
      targetChapters: 500,
      wordsPerChapter: 2500,
    });

    await services.bookService.startBook(bookId);
    await services.bookService.writeNextChapter(bookId);

    const detail = services.bookService.getBookDetail(bookId);
    expect(detail?.book.title).not.toBe('新作品');
    expect(detail?.book.title).toMatch(/[一-龥]/);
    expect(detail?.context?.worldSetting).toMatch(/[一-龥]/);
    expect(detail?.chapters[0]?.content).toMatch(/[一-龥]/);
    expect(detail?.chapters[0]?.content).toContain('逐出山门');
    expect(detail?.latestScene?.location).toMatch(/祖祠废井|问罪台|藏经阁|外门石阶/);
    expect(detail?.plotThreads.some((thread) => /旧案|禁物|古镜/.test(thread.description))).toBe(
      true
    );
    expect(generateText).not.toHaveBeenCalled();
  });

  it('emits deterministic mock chapter stream events through runtime subscriptions', async () => {
    const generateText = vi.fn().mockResolvedValue({
      text: 'should not be used',
    });
    const services = await loadRuntimeServices({
      tempHome,
      generateTextImpl: generateText,
      mockDelayMs: 0,
    });
    const events: unknown[] = [];
    const unsubscribe = services.subscribeBookGeneration((event) => {
      events.push(event);
    });

    const bookId = services.bookService.createBook({
      idea: '一个被宗门逐出的少年，意外继承了会吞噬因果的古镜。',
      targetChapters: 1,
      wordsPerChapter: 90,
    });

    await services.bookService.startBook(bookId);
    await services.bookService.writeNextChapter(bookId);
    unsubscribe();

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bookId,
          type: 'progress',
          stepLabel: '正在写第 1 章',
        }),
        expect.objectContaining({
          bookId,
          type: 'chapter-stream',
          chapterIndex: 1,
          title: expect.any(String),
          delta: expect.stringMatching(/[一-龥]/),
        }),
        expect.objectContaining({
          bookId,
          type: 'chapter-complete',
          chapterIndex: 1,
        }),
      ])
    );
    expect(generateText).not.toHaveBeenCalled();
  });

  it('records chapter completion logs without carrying the active writing phase', async () => {
    const generateText = vi.fn().mockResolvedValue({
      text: 'should not be used',
    });
    const services = await loadRuntimeServices({
      tempHome,
      generateTextImpl: generateText,
      mockDelayMs: 0,
    });
    const logs: Array<{ eventType: string; phase: string | null }> = [];
    const unsubscribe = services.subscribeExecutionLogs((log) => {
      logs.push({ eventType: log.eventType, phase: log.phase });
    });

    const bookId = services.bookService.createBook({
      idea: '一个被宗门逐出的少年，意外继承了会吞噬因果的古镜。',
      targetChapters: 1,
      wordsPerChapter: 90,
    });

    await services.bookService.startBook(bookId);
    await services.bookService.writeNextChapter(bookId);
    unsubscribe();

    expect(logs).toContainEqual({
      eventType: 'chapter_completed',
      phase: null,
    });
    expect(generateText).not.toHaveBeenCalled();
  });

  it('does not record later chapter progress or completion after pausing an in-flight write', async () => {
    vi.useFakeTimers();
    const generateText = vi.fn().mockResolvedValue({
      text: 'should not be used',
    });
    const services = await loadRuntimeServices({
      tempHome,
      generateTextImpl: generateText,
      mockDelayMs: 0,
      mockStreamTokensPerSecond: 100,
    });
    const logs: Array<{ eventType: string; message: string }> = [];
    const unsubscribe = services.subscribeExecutionLogs((log) => {
      logs.push({ eventType: log.eventType, message: log.message });
    });

    const bookId = services.bookService.createBook({
      idea: '一个被宗门逐出的少年，意外继承了会吞噬因果的古镜。',
      targetChapters: 1,
      wordsPerChapter: 90,
    });

    await services.bookService.startBook(bookId);
    const writePromise = services.writeNextChapter(bookId);
    await vi.advanceTimersByTimeAsync(500);

    services.pauseBook(bookId);
    await vi.advanceTimersByTimeAsync(60_000);
    await writePromise;
    unsubscribe();

    const pauseIndex = logs.findIndex((log) => log.eventType === 'book_paused');
    expect(pauseIndex).toBeGreaterThanOrEqual(0);
    expect(logs.slice(pauseIndex + 1).map((log) => log.eventType)).not.toEqual(
      expect.arrayContaining(['book_progress', 'chapter_completed'])
    );
    expect(logs.map((log) => log.message)).not.toContain(
      '正在生成第 1 章摘要与连续性'
    );
    expect(generateText).not.toHaveBeenCalled();
  });

  it('records command-level logs for direct write next and write all actions', async () => {
    const generateText = vi.fn().mockResolvedValue({
      text: 'should not be used',
    });
    const services = await loadRuntimeServices({
      tempHome,
      generateTextImpl: generateText,
      mockDelayMs: 0,
    });
    const logs: Array<{ eventType: string }> = [];
    const unsubscribe = services.subscribeExecutionLogs((log) => {
      logs.push(log);
    });

    const writeNextBookId = services.bookService.createBook({
      idea: '一个被宗门逐出的少年，意外继承了会吞噬因果的古镜。',
      targetChapters: 1,
      wordsPerChapter: 90,
    });
    await services.bookService.startBook(writeNextBookId);
    await services.writeNextChapter(writeNextBookId);

    const writeAllBookId = services.bookService.createBook({
      idea: '一座海底城用潮汐审判所有归来的船。',
      targetChapters: 1,
      wordsPerChapter: 90,
    });
    await services.bookService.startBook(writeAllBookId);
    await services.writeRemainingChapters(writeAllBookId);
    unsubscribe();

    expect(logs.map((log) => log.eventType)).toEqual(
      expect.arrayContaining(['book_write_next', 'book_write_all'])
    );
    expect('logs' in services).toBe(false);
  });

  it('keeps mock runtime generation within the original chapter and word limits', async () => {
    const generateText = vi.fn().mockResolvedValue({
      text: 'should not be used',
    });
    const services = await loadRuntimeServices({
      tempHome,
      generateTextImpl: generateText,
      mockDelayMs: 0,
    });

    const bookId = services.bookService.createBook({
      idea: '一个被宗门逐出的少年，意外继承了会吞噬因果的古镜。',
      targetChapters: 3,
      wordsPerChapter: 90,
    });

    await services.startBook(bookId);

    const detail = await waitForBookStatus(services, bookId, 'completed');

    expect(detail?.book.status).toBe('completed');
    expect(detail?.chapters).toHaveLength(3);
    expect(
      detail?.chapters.every(
        (chapter) =>
          chapter.content &&
          chapter.content.length > 0 &&
          chapter.wordCount === countStoryCharacters(chapter.content)
      )
    ).toBe(true);
    expect(generateText).not.toHaveBeenCalled();
  });

  it('does not swallow real-model failures once a complete config exists', async () => {
    const generateText = vi.fn().mockRejectedValue(new Error('bad key'));
    const services = await loadRuntimeServices({
      tempHome,
      generateTextImpl: generateText,
      mockDelayMs: 0,
    });

    services.modelConfigs.save({
      id: 'openai:gpt-4o-mini',
      provider: 'openai',
      modelName: 'gpt-4o-mini',
      apiKey: 'sk-test',
      baseUrl: '',
      config: {},
    });

    const bookId = services.bookService.createBook({
      idea: '债务审理局的一名底层调查员，发现自己欠下的不是钱，而是命。',
      targetChapters: 500,
      wordsPerChapter: 2500,
    });

    await expect(services.bookService.startBook(bookId)).rejects.toThrow('bad key');
  });

  it('keeps testModel strict when no complete config exists or the model id is missing', async () => {
    const generateText = vi.fn().mockResolvedValue({
      text: 'pong',
    });
    const services = await loadRuntimeServices({
      tempHome,
      generateTextImpl: generateText,
      mockDelayMs: 0,
    });

    await expect(
      services.testModel(DEFAULT_MOCK_MODEL_ID)
    ).resolves.toEqual({
      ok: false,
      latency: 0,
      error: `Model not found: ${DEFAULT_MOCK_MODEL_ID}`,
    });

    services.modelConfigs.save({
      id: 'openai:gpt-4o-mini',
      provider: 'openai',
      modelName: 'gpt-4o-mini',
      apiKey: 'sk-test',
      baseUrl: '',
      config: {},
    });

    await expect(services.testModel('openai:gpt-4o')).resolves.toEqual({
      ok: false,
      latency: 0,
      error: 'Model not found: openai:gpt-4o',
    });
  });

  it('persists urban mock scene and thread data through the runtime pipeline', async () => {
    const generateText = vi.fn().mockResolvedValue({
      text: 'should not be used',
    });
    const services = await loadRuntimeServices({
      tempHome,
      generateTextImpl: generateText,
      mockDelayMs: 0,
    });

    const bookId = services.bookService.createBook({
      idea: '债务审理局的一名底层调查员，发现自己欠下的不是钱，而是命。',
      targetChapters: 500,
      wordsPerChapter: 2500,
    });

    await services.bookService.startBook(bookId);
    await services.bookService.writeNextChapter(bookId);

    const detail = services.bookService.getBookDetail(bookId);

    expect(detail?.latestScene?.location).toMatch(/旧城夜市|高架桥下|封账大厅|地下档案库/);
    expect(detail?.latestScene?.events).toMatch(/冲突|旧案/);
    expect(detail?.plotThreads.some((thread) => /债务|档案|清算/.test(thread.description))).toBe(
      true
    );
    expect(generateText).not.toHaveBeenCalled();
  });

  it('streams mock chapter output at about 200 tokens per second when no model is configured', async () => {
    vi.useFakeTimers();
    const generateText = vi.fn().mockResolvedValue({
      text: 'should not be used',
    });
    const services = await loadRuntimeServices({
      tempHome,
      generateTextImpl: generateText,
      mockStreamTokensPerSecond: null,
    });

    const bookId = services.bookService.createBook({
      idea: '一个被宗门逐出的少年，意外继承了会吞噬因果的古镜。',
      targetChapters: 1,
      wordsPerChapter: 90,
    });
    const events: unknown[] = [];
    const unsubscribe = services.subscribeBookGeneration((event) => {
      if (event.type === 'chapter-stream') {
        events.push(event);
      }
    });

    const startPromise = services.bookService.startBook(bookId);
    await vi.advanceTimersByTimeAsync(2000);
    await startPromise;
    const writePromise = services.bookService.writeNextChapter(bookId);

    await vi.advanceTimersByTimeAsync(14_500);
    await expect(Promise.race([writePromise, Promise.resolve('pending')])).resolves.toBe(
      'pending'
    );
    expect(events.length).toBeGreaterThan(1);

    await vi.advanceTimersByTimeAsync(3000);
    await writePromise;
    unsubscribe();
    const detail = services.bookService.getBookDetail(bookId);

    expect(countStoryCharacters(detail?.chapters[0]?.content ?? '')).toBeGreaterThanOrEqual(
      3000
    );
    expect(generateText).not.toHaveBeenCalled();
  });
});
