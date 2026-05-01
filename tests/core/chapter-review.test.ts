import { describe, expect, it } from 'vitest';
import {
  parseBooleanSetting,
  serializeBooleanSetting,
  SHORT_CHAPTER_REVIEW_ENABLED_KEY,
} from '@story-weaver/shared/settings';
import {
  shouldRewriteShortChapter,
} from '../../src/core/chapter-review';

describe('chapter review settings', () => {
  it('defaults the automatic short-chapter review toggle to enabled', () => {
    expect(SHORT_CHAPTER_REVIEW_ENABLED_KEY).toBe(
      'generation.shortChapterReview.enabled'
    );
    expect(parseBooleanSetting(null)).toBe(true);
    expect(parseBooleanSetting('false')).toBe(false);
    expect(parseBooleanSetting('true')).toBe(true);
    expect(serializeBooleanSetting(false)).toBe('false');
    expect(serializeBooleanSetting(true)).toBe('true');
  });

  it('requests one rewrite when enabled and below the target word count', () => {
    expect(
      shouldRewriteShortChapter({
        enabled: false,
        content: '短章',
        wordsPerChapter: 100,
      })
    ).toBe(false);
    expect(
      shouldRewriteShortChapter({
        enabled: true,
        content: '一'.repeat(99),
        wordsPerChapter: 100,
      })
    ).toBe(true);
    expect(
      shouldRewriteShortChapter({
        enabled: true,
        content: '一'.repeat(100),
        wordsPerChapter: 100,
      })
    ).toBe(false);
  });
});
