import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createEnvironmentModelConfigs,
  createRuntimeConfig,
  createRuntimeEnvReader,
  parseLocalEnv,
} from '../../electron/runtime-env';

const tempRoot = path.resolve(process.cwd(), '.tmp-tests', 'runtime-env');

describe('runtime env reader', () => {
  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('parses local env values with comments, export prefixes, and quotes', () => {
    expect(
      parseLocalEnv(`
        # ignored
        STORY_WEAVER_API_KEY=sk-local # comment
        export STORY_WEAVER_MODEL_NAME='gpt-4o-mini'
        STORY_WEAVER_MOCK_DELAY_MS="0"
      `)
    ).toEqual({
      STORY_WEAVER_API_KEY: 'sk-local',
      STORY_WEAVER_MODEL_NAME: 'gpt-4o-mini',
      STORY_WEAVER_MOCK_DELAY_MS: '0',
    });
  });

  it('prefers .env.local values and falls back to global env when missing', () => {
    fs.mkdirSync(tempRoot, { recursive: true });
    fs.writeFileSync(
      path.join(tempRoot, '.env.local'),
      'STORY_WEAVER_API_KEY=sk-local\n',
      'utf8'
    );

    const reader = createRuntimeEnvReader({
      cwd: tempRoot,
      env: {
        STORY_WEAVER_API_KEY: 'sk-global',
        STORY_WEAVER_MODEL_NAME: 'gpt-4o-mini',
      },
    });

    expect(reader.getValue('STORY_WEAVER_API_KEY')).toBe('sk-local');
    expect(reader.getValue('STORY_WEAVER_MODEL_NAME')).toBe('gpt-4o-mini');
  });

  it('builds environment model config from unified runtime keys', () => {
    const reader = createRuntimeEnvReader({
      cwd: tempRoot,
      env: {
        STORY_WEAVER_MODEL_PROVIDER: 'anthropic',
        STORY_WEAVER_MODEL_NAME: 'claude-sonnet-4-5',
        STORY_WEAVER_API_KEY: 'sk-unified',
        STORY_WEAVER_BASE_URL: 'https://proxy.example.com/anthropic',
      },
    });

    expect(createEnvironmentModelConfigs(reader)).toEqual([
      {
        id: 'anthropic:claude-sonnet-4-5',
        provider: 'anthropic',
        modelName: 'claude-sonnet-4-5',
        apiKey: 'sk-unified',
        baseUrl: 'https://proxy.example.com/anthropic',
        config: {},
      },
    ]);
  });

  it('does not create environment model config from provider-specific legacy keys', () => {
    const reader = createRuntimeEnvReader({
      cwd: tempRoot,
      env: {
        OPENAI_API_KEY: 'sk-openai',
        ANTHROPIC_API_KEY: 'sk-anthropic',
      },
    });

    expect(createEnvironmentModelConfigs(reader)).toEqual([]);
  });

  it('creates the full runtime config from one reader', () => {
    const reader = createRuntimeEnvReader({
      cwd: tempRoot,
      env: {
        STORY_WEAVER_MODEL_PROVIDER: 'openai',
        STORY_WEAVER_MODEL_NAME: 'gpt-4o-mini',
        STORY_WEAVER_API_KEY: 'sk-unified',
        STORY_WEAVER_MOCK_DELAY_MS: '0',
        STORY_WEAVER_MOCK_STREAM_TOKENS_PER_SECOND: '500',
      },
    });

    expect(createRuntimeConfig(reader)).toEqual({
      environmentModelConfigs: [
        {
          id: 'openai:gpt-4o-mini',
          provider: 'openai',
          modelName: 'gpt-4o-mini',
          apiKey: 'sk-unified',
          baseUrl: '',
          config: {},
        },
      ],
      mockRuntimeDelayMs: 0,
      mockStreamTokensPerSecond: 500,
    });
  });
});
