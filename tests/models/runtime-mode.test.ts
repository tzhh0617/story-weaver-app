import { describe, expect, it } from 'vitest';
import { createRuntimeMode } from '@story-weaver/backend/models/runtime-mode';

describe('createRuntimeMode', () => {
  it('throws when no complete model config is available', () => {
    const mode = createRuntimeMode({
      persistedConfigs: [],
      environmentConfigs: [],
    });

    expect(mode.kind).toBe('real');
    expect(mode.availableConfigs).toEqual([]);
    expect(() => mode.resolveModelId()).toThrow('No model configured');
  });

  it('rejects incomplete configs instead of selecting a placeholder model', () => {
    const mode = createRuntimeMode({
      persistedConfigs: [],
      environmentConfigs: [
        {
          id: 'openai:gpt-4o-mini',
          provider: 'openai',
          modelName: 'gpt-4o-mini',
          apiKey: '',
          baseUrl: '',
          config: {},
        },
      ],
    });

    expect(mode.kind).toBe('real');
    expect(mode.availableConfigs).toEqual([]);
    expect(() => mode.resolveModelId()).toThrow('No model configured');
  });

  it('enters real mode when a persisted config is complete', () => {
    const mode = createRuntimeMode({
      persistedConfigs: [
        {
          id: 'openai:gpt-4o-mini',
          provider: 'openai',
          modelName: 'gpt-4o-mini',
          apiKey: 'sk-test',
          baseUrl: '',
          config: {},
        },
      ],
      environmentConfigs: [],
    });

    expect(mode.kind).toBe('real');
    expect(mode.availableConfigs).toHaveLength(1);
    expect(mode.resolveModelId()).toBe('openai:gpt-4o-mini');
  });

  it('prefers persisted configs over duplicate environment configs', () => {
    const mode = createRuntimeMode({
      persistedConfigs: [
        {
          id: 'openai:gpt-4o-mini',
          provider: 'openai',
          modelName: 'gpt-4o-mini',
          apiKey: 'sk-persisted',
          baseUrl: '',
          config: {},
        },
      ],
      environmentConfigs: [
        {
          id: 'openai:gpt-4o-mini',
          provider: 'openai',
          modelName: 'gpt-4o-mini',
          apiKey: 'sk-env',
          baseUrl: '',
          config: {},
        },
      ],
    });

    expect(mode.availableConfigs).toEqual([
      expect.objectContaining({ apiKey: 'sk-persisted' }),
    ]);
  });

  it('can prefer environment configs before persisted configs', () => {
    const mode = createRuntimeMode({
      persistedConfigs: [
        {
          id: 'openai:gpt-4o-mini',
          provider: 'openai',
          modelName: 'gpt-4o-mini',
          apiKey: 'sk-persisted',
          baseUrl: '',
          config: {},
        },
      ],
      environmentConfigs: [
        {
          id: 'anthropic:claude-3-5-sonnet',
          provider: 'anthropic',
          modelName: 'claude-3-5-sonnet',
          apiKey: 'sk-env',
          baseUrl: '',
          config: {},
        },
      ],
      preferEnvironmentConfigs: true,
    });

    expect(mode.kind).toBe('real');
    expect(mode.resolveModelId()).toBe('anthropic:claude-3-5-sonnet');
  });

  it('falls back to persisted configs when preferred environment configs are incomplete', () => {
    const mode = createRuntimeMode({
      persistedConfigs: [
        {
          id: 'openai:gpt-4o-mini',
          provider: 'openai',
          modelName: 'gpt-4o-mini',
          apiKey: 'sk-persisted',
          baseUrl: '',
          config: {},
        },
      ],
      environmentConfigs: [
        {
          id: 'anthropic:claude-3-5-sonnet',
          provider: 'anthropic',
          modelName: 'claude-3-5-sonnet',
          apiKey: '',
          baseUrl: '',
          config: {},
        },
      ],
      preferEnvironmentConfigs: true,
    });

    expect(mode.kind).toBe('real');
    expect(mode.resolveModelId()).toBe('openai:gpt-4o-mini');
  });
});
