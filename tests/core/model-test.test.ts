import { describe, expect, it, vi } from 'vitest';
import { createModelTestService } from '@story-weaver/backend/core/model-test';

describe('createModelTestService', () => {
  it('returns ok and latency when the model responds', async () => {
    const fakeModel = { id: 'model' };
    const registry = {
      languageModel: vi.fn().mockReturnValue(fakeModel),
    };
    const generateText = vi.fn().mockResolvedValue({ text: 'pong' });

    const service = createModelTestService({
      registry: registry as never,
      generateText: generateText as never,
      now: vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(160),
    });

    await expect(service.testModel('openai:gpt-4o-mini')).resolves.toEqual({
      ok: true,
      latency: 60,
      error: null,
    });
  });

  it('returns the error when the model call fails', async () => {
    const registry = {
      languageModel: vi.fn().mockReturnValue({ id: 'model' }),
    };
    const generateText = vi.fn().mockRejectedValue(new Error('bad key'));

    const service = createModelTestService({
      registry: registry as never,
      generateText: generateText as never,
      now: vi.fn().mockReturnValueOnce(10).mockReturnValueOnce(30),
    });

    await expect(service.testModel('openai:gpt-4o-mini')).resolves.toEqual({
      ok: false,
      latency: 20,
      error: 'bad key',
    });
  });
});
