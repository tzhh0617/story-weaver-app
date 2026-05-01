import { describe, expect, it } from 'vitest';
import {
  formatChapterWordCount,
  formatTotalWordCount,
} from '@story-weaver/frontend/word-count-format';

describe('word count formatting', () => {
  it('uses Chinese units with at most one decimal place', () => {
    expect(formatChapterWordCount(280)).toBe('0.3 千字');
    expect(formatChapterWordCount(2800)).toBe('2.8 千字');
    expect(formatChapterWordCount(1000)).toBe('1 千字');
    expect(formatTotalWordCount(12000)).toBe('1.2 万字');
    expect(formatTotalWordCount(1300)).toBe('0.1 万字');
  });
});
