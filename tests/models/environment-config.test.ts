import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveEnvironmentModelConfigs } from '@story-weaver/backend/models/environment-config';

let tempDirs: string[] = [];

function createTempDir() {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'story-weaver-env-'));
  tempDirs.push(tempDir);
  return tempDir;
}

afterEach(() => {
  for (const tempDir of tempDirs) {
    rmSync(tempDir, { force: true, recursive: true });
  }

  tempDirs = [];
});

describe('resolveEnvironmentModelConfigs', () => {
  it('prefers the provider from local .env.local', () => {
    const cwd = createTempDir();
    writeFileSync(
      path.join(cwd, '.env.local'),
      [
        'STORY_WEAVER_MODEL_PROVIDER=anthropic',
        'STORY_WEAVER_MODEL_NAME=claude-opus-4-5',
        'STORY_WEAVER_BASE_URL=https://example.com/anthropic/v1',
        '',
      ].join('\n')
    );

    const result = resolveEnvironmentModelConfigs({
      cwd,
      env: {
        STORY_WEAVER_API_KEY: 'sk-story-weaver',
      },
    });

    expect(result.preferEnvironmentConfigs).toBe(true);
    expect(result.configs).toEqual([
      expect.objectContaining({
        id: 'anthropic:claude-opus-4-5',
        provider: 'anthropic',
        modelName: 'claude-opus-4-5',
        apiKey: 'sk-story-weaver',
        baseUrl: 'https://example.com/anthropic/v1',
      }),
    ]);
  });

  it('ignores env.local without the leading dot', () => {
    const cwd = createTempDir();
    writeFileSync(
      path.join(cwd, 'env.local'),
      'STORY_WEAVER_MODEL_PROVIDER=openai\n'
    );

    const result = resolveEnvironmentModelConfigs({
      cwd,
      env: {
        STORY_WEAVER_API_KEY: 'sk-story-weaver',
      },
    });

    expect(result.preferEnvironmentConfigs).toBe(false);
    expect(result.configs.map((config) => config.provider)).toEqual([
      'openai',
      'anthropic',
    ]);
  });

  it('can ignore local .env.local files for hermetic runtimes', () => {
    const cwd = createTempDir();
    writeFileSync(
      path.join(cwd, '.env.local'),
      [
        'STORY_WEAVER_MODEL_PROVIDER=openai',
        'STORY_WEAVER_MODEL_NAME=gpt-5.5',
        'STORY_WEAVER_API_KEY=sk-local',
        '',
      ].join('\n')
    );

    const result = resolveEnvironmentModelConfigs({
      cwd,
      env: {
        STORY_WEAVER_DISABLE_LOCAL_ENV: '1',
      },
    });

    expect(result.preferEnvironmentConfigs).toBe(false);
    expect(result.configs).toEqual([]);
  });
});
