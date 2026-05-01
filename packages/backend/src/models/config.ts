export type ModelProvider = 'openai' | 'anthropic';

export type ModelConfigInput = {
  id: string;
  provider: ModelProvider;
  modelName: string;
  apiKey: string;
  baseUrl: string;
  config: Record<string, unknown>;
};

const supportedProviders = new Set(['openai', 'anthropic']);

function normalizeModelName(provider: ModelProvider, value: string) {
  const trimmedValue = value.trim();
  const providerPrefix = `${provider}:`;

  if (trimmedValue.startsWith(providerPrefix)) {
    return trimmedValue.slice(providerPrefix.length).trim();
  }

  return trimmedValue;
}

export function normalizeModelId(value: string) {
  const trimmedValue = value.trim();

  for (const provider of supportedProviders) {
    const repeatedPrefix = `${provider}:${provider}:`;

    if (trimmedValue.startsWith(repeatedPrefix)) {
      return `${provider}:${trimmedValue.slice(repeatedPrefix.length).trim()}`;
    }
  }

  return trimmedValue;
}

export function validateModelConfig(input: ModelConfigInput) {
  const provider = input.provider;
  const modelName = supportedProviders.has(provider)
    ? normalizeModelName(provider, input.modelName)
    : input.modelName.trim();
  const id = supportedProviders.has(provider)
    ? `${provider}:${modelName}`
    : input.id.trim();

  if (!id) {
    throw new Error('id is required');
  }

  if (!supportedProviders.has(provider)) {
    throw new Error('unsupported provider');
  }

  if (!modelName) {
    throw new Error('modelName is required');
  }

  if (!input.apiKey.trim()) {
    throw new Error('apiKey is required');
  }

  return {
    ...input,
    id,
    modelName,
    apiKey: input.apiKey.trim(),
    baseUrl: input.baseUrl.trim(),
  };
}
