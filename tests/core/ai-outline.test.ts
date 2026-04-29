import { describe, expect, it, vi } from 'vitest';
import { createAiOutlineService } from '../../src/core/ai-outline';

describe('createAiOutlineService', () => {
  it('resolves the selected model from the registry and generates layered outlines', async () => {
    const fakeModel = { id: 'model' };
    const registry = {
      languageModel: vi.fn().mockReturnValue(fakeModel),
    };
    const generateText = vi
      .fn()
      .mockResolvedValueOnce({ text: '月税奇谈' })
      .mockResolvedValueOnce({ text: 'world' })
      .mockResolvedValueOnce({ text: 'outline' })
      .mockResolvedValueOnce({ text: 'Volume 1' })
      .mockResolvedValueOnce({ text: '1|Chapter 1|Outline 1' });

    const service = createAiOutlineService({
      registry: registry as never,
      generateText: generateText as never,
    });
    const onChapterOutlines = vi.fn();

    const title = await service.generateTitleFromIdea({
      bookId: 'book-1',
      idea: 'The moon taxes miracles.',
      targetChapters: 1,
      wordsPerChapter: 2500,
      modelId: 'openai:gpt-4o-mini',
    });
    const result = await service.generateFromIdea({
      bookId: 'book-1',
      idea: 'The moon taxes miracles.',
      targetChapters: 1,
      wordsPerChapter: 2500,
      modelId: 'openai:gpt-4o-mini',
      onChapterOutlines,
    });

    expect(registry.languageModel).toHaveBeenCalledWith('openai:gpt-4o-mini');
    expect(title).toBe('月税奇谈');
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({ model: fakeModel })
    );
    expect(result.chapterOutlines).toEqual([
      expect.objectContaining({
        volumeIndex: 1,
        chapterIndex: 1,
        title: 'Chapter 1',
      }),
    ]);
    expect(onChapterOutlines).toHaveBeenCalledWith([
      expect.objectContaining({
        volumeIndex: 1,
        chapterIndex: 1,
        title: 'Chapter 1',
      }),
    ]);
  });

  it('normalizes model chapter outlines to the requested target chapter count', async () => {
    const fakeModel = { id: 'model' };
    const registry = {
      languageModel: vi.fn().mockReturnValue(fakeModel),
    };
    const generateText = vi
      .fn()
      .mockResolvedValueOnce({ text: 'world' })
      .mockResolvedValueOnce({ text: 'outline' })
      .mockResolvedValueOnce({ text: 'Volume 1' })
      .mockResolvedValueOnce({
        text: [
          '1|第一章|开局',
          '2|第二章|升级',
          '3|第三章|超出设定',
        ].join('\n'),
      });

    const service = createAiOutlineService({
      registry: registry as never,
      generateText: generateText as never,
    });
    const onChapterOutlines = vi.fn();

    const result = await service.generateFromIdea({
      bookId: 'book-1',
      idea: 'The moon taxes miracles.',
      targetChapters: 2,
      wordsPerChapter: 180,
      modelId: 'openai:gpt-4o-mini',
      onChapterOutlines,
    });

    expect(result.chapterOutlines).toHaveLength(2);
    expect(result.chapterOutlines.map((chapter) => chapter.chapterIndex)).toEqual([
      1, 2,
    ]);
    expect(onChapterOutlines).toHaveBeenCalledWith(result.chapterOutlines);
  });

  it('stops requesting chapter outlines once the target chapter count is reached', async () => {
    const fakeModel = { id: 'model' };
    const registry = {
      languageModel: vi.fn().mockReturnValue(fakeModel),
    };
    const generateText = vi
      .fn()
      .mockResolvedValueOnce({ text: 'world' })
      .mockResolvedValueOnce({ text: 'outline' })
      .mockResolvedValueOnce({ text: 'Volume 1\n---\nVolume 2' })
      .mockResolvedValueOnce({
        text: ['1|第一章|开局', '2|第二章|升级'].join('\n'),
      });

    const service = createAiOutlineService({
      registry: registry as never,
      generateText: generateText as never,
    });

    const result = await service.generateFromIdea({
      bookId: 'book-1',
      idea: 'The moon taxes miracles.',
      targetChapters: 2,
      wordsPerChapter: 180,
      modelId: 'openai:gpt-4o-mini',
    });

    expect(result.chapterOutlines).toHaveLength(2);
    expect(generateText).toHaveBeenCalledTimes(4);
  });
});
