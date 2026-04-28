import { describe, expect, it } from 'vitest';
import { createDevelopmentOutlineService } from '../../src/core/development-outline';

describe('createDevelopmentOutlineService', () => {
  it('produces a deterministic outline bundle without external model calls', async () => {
    const service = createDevelopmentOutlineService();

    const result = await service.generateFromIdea({
      bookId: 'book-1',
      idea: 'The moon taxes miracles.',
      targetWords: 300000,
    });

    expect(result.worldSetting).toContain('The moon taxes miracles.');
    expect(result.masterOutline).toContain('300000');
    expect(result.volumeOutlines.length).toBeGreaterThan(0);
    expect(result.chapterOutlines[0]).toEqual(
      expect.objectContaining({
        volumeIndex: 1,
        chapterIndex: 1,
      })
    );
  });
});
