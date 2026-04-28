import { describe, expect, it } from 'vitest';
import {
  createRuntimeMode,
  DEFAULT_MOCK_MODEL_ID,
} from '../../src/models/runtime-mode';

describe('createRuntimeMode', () => {
  it('enters mock mode when no complete model config is available', () => {
    const mode = createRuntimeMode({
      persistedConfigs: [],
      environmentConfigs: [],
      fallbackModelId: DEFAULT_MOCK_MODEL_ID,
    });

    expect(mode.kind).toBe('mock');
    expect(mode.availableConfigs).toEqual([]);
    expect(mode.resolveModelId()).toBe(DEFAULT_MOCK_MODEL_ID);
  });

  it('stays in mock mode when configs exist but are incomplete', () => {
    const mode = createRuntimeMode({
      persistedConfigs: [],
      environmentConfigs: [
        {
          id: 'custom:demo',
          provider: 'custom',
          modelName: 'demo',
          apiKey: 'sk-test',
          baseUrl: '',
          config: {},
        },
      ],
      fallbackModelId: DEFAULT_MOCK_MODEL_ID,
    });

    expect(mode.kind).toBe('mock');
    expect(mode.availableConfigs).toEqual([]);
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
      fallbackModelId: DEFAULT_MOCK_MODEL_ID,
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
      fallbackModelId: DEFAULT_MOCK_MODEL_ID,
    });

    expect(mode.availableConfigs).toEqual([
      expect.objectContaining({ apiKey: 'sk-persisted' }),
    ]);
  });
});
