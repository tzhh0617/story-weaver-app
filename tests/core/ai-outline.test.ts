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
      .mockResolvedValueOnce({ text: 'world' })
      .mockResolvedValueOnce({ text: 'outline' })
      .mockResolvedValueOnce({ text: 'Volume 1' })
      .mockResolvedValueOnce({ text: '1|Chapter 1|Outline 1' });

    const service = createAiOutlineService({
      registry: registry as never,
      generateText: generateText as never,
    });

    const result = await service.generateFromIdea({
      bookId: 'book-1',
      idea: 'The moon taxes miracles.',
      targetWords: 300000,
      modelId: 'openai:gpt-4o-mini',
    });

    expect(registry.languageModel).toHaveBeenCalledWith('openai:gpt-4o-mini');
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
  });
});
