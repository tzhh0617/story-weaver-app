import { describe, expect, it } from 'vitest';
import { createDevelopmentOutlineService } from '@story-weaver/backend/core/development-outline';

describe('createDevelopmentOutlineService', () => {
  it('produces a Chinese mock outline bundle without external model calls', async () => {
    const service = createDevelopmentOutlineService();

    const result = await service.generateFromIdea({
      bookId: 'book-1',
      idea: '一个被宗门逐出的少年，意外继承了会吞噬因果的古镜。',
      targetChapters: 500,
      wordsPerChapter: 2500,
    });

    expect(result.worldSetting).toMatch(/[一-龥]/);
    expect(result.worldSetting).toContain('故事核心');
    expect(result.masterOutline).toContain('目标章节数：500');
    expect(result.masterOutline).toContain('每章字数：2500');
    expect(result.masterOutline).toContain('主线');
    expect(result.volumeOutlines.length).toBeGreaterThan(0);
    expect(result.volumeOutlines[0]).toContain('卷');
    expect(result.chapterOutlines[0]).toEqual(
      expect.objectContaining({
        volumeIndex: 1,
        chapterIndex: 1,
      })
    );
    expect(result.chapterOutlines[0]?.title).toMatch(/[一-龥]/);
  });
});
