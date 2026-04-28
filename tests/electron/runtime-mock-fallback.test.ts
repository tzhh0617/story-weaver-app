import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_MOCK_MODEL_ID } from '../../src/models/runtime-mode';

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
}) {
  vi.resetModules();
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

describe('runtime mock fallback', () => {
  let tempHome = '';

  beforeEach(() => {
    tempHome = makeTempHome('case');
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  afterEach(() => {
    vi.doUnmock('node:os');
    vi.doUnmock('ai');
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  it('uses Chinese mock story services when no complete model config exists', async () => {
    const generateText = vi.fn().mockResolvedValue({
      text: 'should not be used',
    });
    const services = await loadRuntimeServices({
      tempHome,
      generateTextImpl: generateText,
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

  it('does not swallow real-model failures once a complete config exists', async () => {
    const generateText = vi.fn().mockRejectedValue(new Error('bad key'));
    const services = await loadRuntimeServices({
      tempHome,
      generateTextImpl: generateText,
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
});
