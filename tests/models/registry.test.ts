import { describe, expect, it } from 'vitest';
import { validateModelConfig } from '../../src/models/config';

describe('validateModelConfig', () => {
  it('rejects unsupported model providers', () => {
    expect(() =>
      validateModelConfig({
        id: 'deepseek-chat',
        provider: 'deepseek' as never,
        modelName: 'deepseek-chat',
        apiKey: 'sk-test',
        baseUrl: 'https://api.deepseek.com',
        config: {},
      })
    ).toThrow(/unsupported provider/);
  });
});
