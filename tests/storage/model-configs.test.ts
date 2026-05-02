import { describe, expect, it } from 'vitest';
import { createDatabase } from '../../src/storage/database';
import { createModelConfigRepository } from '../../src/storage/model-configs';

describe('model config repository', () => {
  it('saves and lists the single persisted model config', () => {
    const db = createDatabase(':memory:');
    const repo = createModelConfigRepository(db);

    repo.save({
      id: 'openai:gpt-4o-mini',
      provider: 'openai',
      modelName: 'gpt-4o-mini',
      apiKey: 'sk-test',
      baseUrl: '',
      config: { temperature: 0.7 },
    });

    expect(repo.list()).toEqual([
      expect.objectContaining({
        id: 'openai:gpt-4o-mini',
        provider: 'openai',
        modelName: 'gpt-4o-mini',
        apiKey: 'sk-test',
        baseUrl: '',
        config: { temperature: 0.7 },
      }),
    ]);
  });

  it('replaces the existing persisted model config when saving another one', () => {
    const db = createDatabase(':memory:');
    const repo = createModelConfigRepository(db);

    repo.save({
      id: 'openai:gpt-4o-mini',
      provider: 'openai',
      modelName: 'gpt-4o-mini',
      apiKey: 'sk-test',
      baseUrl: '',
      config: {},
    });

    repo.save({
      id: 'anthropic:claude-3-5-sonnet',
      provider: 'anthropic',
      modelName: 'claude-3-5-sonnet',
      apiKey: 'sk-new',
      baseUrl: '',
      config: {},
    });

    expect(repo.list()).toEqual([
      expect.objectContaining({
        id: 'anthropic:claude-3-5-sonnet',
        provider: 'anthropic',
        modelName: 'claude-3-5-sonnet',
        apiKey: 'sk-new',
      }),
    ]);
    expect(repo.getById('openai:gpt-4o-mini')).toBeNull();
  });

  it('returns null when the requested model config does not exist', () => {
    const db = createDatabase(':memory:');
    const repo = createModelConfigRepository(db);

    expect(repo.getById('missing')).toBeNull();
  });
});
