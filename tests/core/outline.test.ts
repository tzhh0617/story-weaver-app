import { describe, expect, it, vi } from 'vitest';
import { createOutlineService } from '../../src/core/outline';

describe('createOutlineService', () => {
  it('calls the model in world -> master -> volume -> chapter order', async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce({ text: 'world' })
      .mockResolvedValueOnce({ text: 'outline' })
      .mockResolvedValueOnce({ text: 'Volume 1\n---\nVolume 2' })
      .mockResolvedValueOnce({ text: '1|Chapter 1|Outline 1' })
      .mockResolvedValueOnce({ text: '1|Chapter 1|Outline 2' });

    const service = createOutlineService({ generateText: generate });

    await service.generateFromIdea({
      bookId: 'book-1',
      idea: 'The moon taxes miracles.',
      targetWords: 500000,
    });

    expect(generate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        prompt: expect.stringContaining('The moon taxes miracles.'),
      })
    );
    expect(generate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        prompt: expect.stringContaining('world'),
      })
    );
    expect(generate).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        prompt: expect.stringContaining('outline'),
      })
    );
    expect(generate).toHaveBeenCalledTimes(5);
  });
});
