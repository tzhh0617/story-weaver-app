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

  it('forwards streaming chunks while returning the final chapter text', async () => {
    const streamText = vi.fn(async function* () {
      yield '第一段';
      yield '第二段';
    });
    const onChunk = vi.fn();
    const writer = createChapterWriter({
      generateText: vi.fn(),
      streamText,
    });

    const result = await writer.writeChapter({
      prompt: 'Write chapter 1',
      onChunk,
    });

    expect(onChunk).toHaveBeenNthCalledWith(1, '第一段');
    expect(onChunk).toHaveBeenNthCalledWith(2, '第二段');
    expect(result.content).toBe('第一段第二段');
  });
});
