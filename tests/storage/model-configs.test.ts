import { describe, expect, it } from 'vitest';
import { createDatabase } from '../../src/storage/database';
import { createModelConfigRepository } from '../../src/storage/model-configs';

describe('model config repository', () => {
  it('saves and lists persisted model configs', () => {
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

  it('deletes a persisted model config', () => {
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

    repo.delete('openai:gpt-4o-mini');

    expect(repo.list()).toEqual([]);
  });
});
