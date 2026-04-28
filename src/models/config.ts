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

export function validateModelConfig(input: ModelConfigInput) {
  if (!input.id.trim()) {
    throw new Error('id is required');
  }

  if (!supportedProviders.has(input.provider)) {
    throw new Error('unsupported provider');
  }

  if (!input.modelName.trim()) {
    throw new Error('modelName is required');
  }

  if (!input.apiKey.trim()) {
    throw new Error('apiKey is required');
  }

  return {
    ...input,
    id: input.id.trim(),
    modelName: input.modelName.trim(),
    apiKey: input.apiKey.trim(),
    baseUrl: input.baseUrl.trim(),
  };
}
