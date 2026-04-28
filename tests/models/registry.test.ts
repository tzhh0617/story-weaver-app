import { describe, expect, it } from 'vitest';
import { validateModelConfig } from '../../src/models/config';

describe('validateModelConfig', () => {
  it('requires baseUrl for custom openai-compatible providers', () => {
    expect(() =>
      validateModelConfig({
        id: 'deepseek-chat',
        provider: 'deepseek',
        modelName: 'deepseek-chat',
        apiKey: 'sk-test',
        baseUrl: '',
        config: {},
      })
    ).toThrow(/baseUrl/);
  });
});
