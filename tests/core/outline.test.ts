import { describe, expect, it, vi } from 'vitest';
import { createOutlineService } from '../../src/core/outline';

describe('createOutlineService', () => {
  it('calls the model in world -> master -> volume -> chapter order', async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce({ text: '月税奇谈' })
      .mockResolvedValueOnce({ text: 'world' })
      .mockResolvedValueOnce({ text: 'outline' })
      .mockResolvedValueOnce({ text: 'Volume 1\n---\nVolume 2' })
      .mockResolvedValueOnce({ text: '1|Chapter 1|Outline 1' })
      .mockResolvedValueOnce({ text: '1|Chapter 1|Outline 2' });

    const service = createOutlineService({ generateText: generate });
    const onChapterOutlines = vi.fn();

    const title = await service.generateTitleFromIdea({
      bookId: 'book-1',
      idea: 'The moon taxes miracles.',
      targetChapters: 500,
      wordsPerChapter: 2500,
    });
    const result = await service.generateFromIdea({
      bookId: 'book-1',
      idea: 'The moon taxes miracles.',
      targetChapters: 500,
      wordsPerChapter: 2500,
      onChapterOutlines,
    });

    expect(title).toBe('月税奇谈');
    expect(result.worldSetting).toBe('world');
    expect(generate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        prompt: expect.stringContaining('The moon taxes miracles.'),
      })
    );
    expect(generate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        prompt: expect.stringContaining('The moon taxes miracles.'),
      })
    );
    expect(generate).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        prompt: expect.stringContaining('world'),
      })
    );
    expect(generate).toHaveBeenCalledTimes(6);
    expect(onChapterOutlines).toHaveBeenCalledTimes(2);
    expect(onChapterOutlines).toHaveBeenNthCalledWith(1, [
      expect.objectContaining({
        volumeIndex: 1,
        chapterIndex: 1,
        title: 'Chapter 1',
      }),
    ]);
  });
});
