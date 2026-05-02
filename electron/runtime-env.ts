import fs from 'node:fs';
import path from 'node:path';
import type { ModelConfigInput, ModelProvider } from '../src/models/config.js';

const LOCAL_ENV_FILE_NAME = '.env.local';
const LOCAL_ENV_PATH_KEY = 'STORY_WEAVER_LOCAL_ENV_PATH';
const MODEL_PROVIDER_KEY = 'STORY_WEAVER_MODEL_PROVIDER';
const MODEL_NAME_KEY = 'STORY_WEAVER_MODEL_NAME';
const API_KEY_KEY = 'STORY_WEAVER_API_KEY';
const BASE_URL_KEY = 'STORY_WEAVER_BASE_URL';
const MOCK_DELAY_MS_KEY = 'STORY_WEAVER_MOCK_DELAY_MS';
const MOCK_STREAM_TOKENS_PER_SECOND_KEY =
  'STORY_WEAVER_MOCK_STREAM_TOKENS_PER_SECOND';
const DEFAULT_MOCK_RUNTIME_DELAY_MS = 1000;
const DEFAULT_MOCK_STREAM_TOKENS_PER_SECOND = 200;
const supportedModelProviders = new Set<ModelProvider>(['openai', 'anthropic']);

export type RuntimeConfig = {
  environmentModelConfigs: ModelConfigInput[];
  mockRuntimeDelayMs: number;
  mockStreamTokensPerSecond: number;
};

export function parseLocalEnv(source: string) {
  const values: Record<string, string> = {};

  for (const line of source.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    const value = rawValue.trim();
    const quote = value[0];
    if (
      value.length >= 2 &&
      (quote === '"' || quote === "'") &&
      value[value.length - 1] === quote
    ) {
      values[key] = value.slice(1, -1);
    } else {
      values[key] = value.replace(/\s+#.*$/u, '');
    }
  }

  return values;
}

export function createRuntimeEnvReader(input?: {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}) {
  const cwd = input?.cwd ?? process.cwd();
  const env = input?.env ?? process.env;
  let localEnvCache: Record<string, string> | null = null;

  function getLocalEnv() {
    if (localEnvCache) {
      return localEnvCache;
    }

    const envPath = env[LOCAL_ENV_PATH_KEY] ?? path.resolve(cwd, LOCAL_ENV_FILE_NAME);
    if (!fs.existsSync(envPath)) {
      localEnvCache = {};
      return localEnvCache;
    }

    localEnvCache = parseLocalEnv(fs.readFileSync(envPath, 'utf8'));
    return localEnvCache;
  }

  return {
    getValue(key: string) {
      return getLocalEnv()[key] ?? env[key];
    },
  };
}

export function createEnvironmentModelConfigs(input: {
  getValue: (key: string) => string | undefined;
}): ModelConfigInput[] {
  const provider = input.getValue(MODEL_PROVIDER_KEY);
  const modelName = input.getValue(MODEL_NAME_KEY);
  const apiKey = input.getValue(API_KEY_KEY);
  const baseUrl = input.getValue(BASE_URL_KEY) ?? '';

  if (
    !provider ||
    !supportedModelProviders.has(provider as ModelProvider) ||
    !modelName ||
    !apiKey
  ) {
    return [];
  }

  return [
    {
      id: `${provider}:${modelName}`,
      provider: provider as ModelProvider,
      modelName,
      apiKey,
      baseUrl,
      config: {},
    },
  ];
}

function parseMockRuntimeDelayMs(value: string | undefined) {
  if (value === undefined) {
    return DEFAULT_MOCK_RUNTIME_DELAY_MS;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_MOCK_RUNTIME_DELAY_MS;
  }

  return parsed;
}

function parseMockStreamTokensPerSecond(value: string | undefined) {
  if (value === undefined) {
    return DEFAULT_MOCK_STREAM_TOKENS_PER_SECOND;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MOCK_STREAM_TOKENS_PER_SECOND;
  }

  return parsed;
}

export function createRuntimeConfig(input: {
  getValue: (key: string) => string | undefined;
}): RuntimeConfig {
  return {
    environmentModelConfigs: createEnvironmentModelConfigs(input),
    mockRuntimeDelayMs: parseMockRuntimeDelayMs(input.getValue(MOCK_DELAY_MS_KEY)),
    mockStreamTokensPerSecond: parseMockStreamTokensPerSecond(
      input.getValue(MOCK_STREAM_TOKENS_PER_SECOND_KEY)
    ),
  };
}

export const runtimeEnv = createRuntimeEnvReader();
export const runtimeConfig = createRuntimeConfig(runtimeEnv);
