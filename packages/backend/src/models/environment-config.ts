import fs from 'node:fs';
import path from 'node:path';
import type { ModelConfigInput, ModelProvider } from './config.js';

type EnvironmentModelConfigInput = {
  cwd?: string;
  env?: Partial<NodeJS.ProcessEnv>;
};

const providerDefaults: Record<
  ModelProvider,
  {
    id: string;
    modelName: string;
  }
> = {
  openai: {
    id: 'openai:gpt-4o-mini',
    modelName: 'gpt-4o-mini',
  },
  anthropic: {
    id: 'anthropic:claude-3-5-sonnet',
    modelName: 'claude-3-5-sonnet',
  },
};

const supportedProviders = new Set<ModelProvider>(['openai', 'anthropic']);

function parseProvider(value: string | undefined): ModelProvider | null {
  if (!value) {
    return null;
  }

  const normalizedValue = value.trim().toLowerCase();
  return supportedProviders.has(normalizedValue as ModelProvider)
    ? (normalizedValue as ModelProvider)
    : null;
}

function parseLocalEnvFile(content: string) {
  const values: Record<string, string> = {};

  for (const line of content.split(/\r?\n/u)) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
    values[key] = rawValue.replace(/^(['"])(.*)\1$/u, '$2');
  }

  return values;
}

function findLocalEnvFile(cwd: string) {
  let currentDir = path.resolve(cwd);

  while (true) {
    const candidate = path.join(currentDir, '.env.local');
    if (fs.existsSync(candidate)) {
      return candidate;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }

    currentDir = parentDir;
  }
}

function loadLocalEnv(cwd: string) {
  const envFilePath = findLocalEnvFile(cwd);
  if (!envFilePath) {
    return {};
  }

  return parseLocalEnvFile(fs.readFileSync(envFilePath, 'utf8'));
}

function createProviderConfig(
  provider: ModelProvider,
  env: Partial<NodeJS.ProcessEnv>,
  modelNameOverride?: string,
  baseUrlOverride?: string
): ModelConfigInput | null {
  const defaults = providerDefaults[provider];
  const apiKey = env.STORY_WEAVER_API_KEY;
  const modelName = modelNameOverride?.trim() || defaults.modelName;
  const baseUrl = baseUrlOverride?.trim() || '';

  if (!apiKey) {
    return null;
  }

  return {
    id: `${provider}:${modelName}`,
    provider,
    modelName,
    apiKey,
    baseUrl,
    config: {},
  };
}

export function resolveEnvironmentModelConfigs(
  input: EnvironmentModelConfigInput = {}
) {
  const localEnv = loadLocalEnv(input.cwd ?? process.cwd());
  const mergedEnv = {
    ...(input.env ?? process.env),
    ...localEnv,
  };
  const localProvider = parseProvider(localEnv.STORY_WEAVER_MODEL_PROVIDER);
  const localModelName = localEnv.STORY_WEAVER_MODEL_NAME?.trim() || undefined;
  const localBaseUrl = localEnv.STORY_WEAVER_BASE_URL?.trim() || undefined;
  const providers = localProvider
    ? [localProvider]
    : (['openai', 'anthropic'] as ModelProvider[]);

  return {
    configs: providers.flatMap((provider) => {
      const config = createProviderConfig(
        provider,
        mergedEnv,
        localProvider === provider ? localModelName : undefined,
        localProvider === provider ? localBaseUrl : undefined
      );
      return config ? [config] : [];
    }),
    preferEnvironmentConfigs: localProvider !== null,
  };
}
