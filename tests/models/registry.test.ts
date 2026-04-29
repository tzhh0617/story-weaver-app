import { describe, expect, it } from 'vitest';
import { validateModelConfig } from '../../src/models/config';
import { createRuntimeRegistry } from '../../src/models/registry';

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

describe('createRuntimeRegistry', () => {
  it('uses the configured OpenAI base URL with chat completions', () => {
    const registry = createRuntimeRegistry([
      {
        id: 'openai:gpt-4o-mini',
        provider: 'openai',
        modelName: 'gpt-4o-mini',
        apiKey: 'sk-test',
        baseUrl: 'https://proxy.example.com/openai/v1',
        config: {},
      },
    ]);

    const model = (
      registry as unknown as {
        languageModel: (modelId: string) => {
          config: {
            provider: string;
            url: (input: { path: string }) => string;
          };
        };
      }
    ).languageModel('openai:gpt-4o-mini');

    expect(model.config.provider).toBe('openai.chat');
    expect(model.config.url({ path: '/chat/completions' })).toBe(
      'https://proxy.example.com/openai/v1/chat/completions'
    );
  });

  it('uses the configured Anthropic base URL when creating the language model', () => {
    const registry = createRuntimeRegistry([
      {
        id: 'anthropic:claude-3-5-sonnet',
        provider: 'anthropic',
        modelName: 'claude-3-5-sonnet',
        apiKey: 'sk-test',
        baseUrl: 'https://proxy.example.com/anthropic/v1',
        config: {},
      },
    ]);

    const model = (
      registry as unknown as {
        languageModel: (modelId: string) => {
          config: { baseURL: string };
        };
      }
    ).languageModel('anthropic:claude-3-5-sonnet');

    expect(model.config.baseURL).toBe('https://proxy.example.com/anthropic/v1');
  });
});
