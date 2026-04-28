import { describe, expect, it, vi } from 'vitest';
import { createChapterWriter } from '../../src/core/chapter-writer';

describe('createChapterWriter', () => {
  it('records tokens and returns chapter text', async () => {
    const generateText = vi.fn().mockResolvedValue({
      text: 'Chapter output',
      usage: { inputTokens: 100, outputTokens: 400 },
    });

    const writer = createChapterWriter({ generateText });
    const result = await writer.writeChapter({ prompt: 'Write chapter 1' });

    expect(result.content).toBe('Chapter output');
    expect(result.usage.outputTokens).toBe(400);
  });
});
