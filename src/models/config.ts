export type ModelProvider =
  | 'openai'
  | 'anthropic'
  | 'deepseek'
  | 'qwen'
  | 'glm'
  | 'custom';

export type ModelConfigInput = {
  id: string;
  provider: ModelProvider;
  modelName: string;
  apiKey: string;
  baseUrl: string;
  config: Record<string, unknown>;
};

const openAICompatibleProviders = new Set<ModelProvider>([
  'deepseek',
  'qwen',
  'glm',
  'custom',
]);

export function validateModelConfig(input: ModelConfigInput) {
  if (!input.id.trim()) {
    throw new Error('id is required');
  }

  if (!input.modelName.trim()) {
    throw new Error('modelName is required');
  }

  if (!input.apiKey.trim()) {
    throw new Error('apiKey is required');
  }

  if (
    openAICompatibleProviders.has(input.provider) &&
    !input.baseUrl.trim()
  ) {
    throw new Error('baseUrl is required for openai-compatible providers');
  }

  return {
    ...input,
    id: input.id.trim(),
    modelName: input.modelName.trim(),
    apiKey: input.apiKey.trim(),
    baseUrl: input.baseUrl.trim(),
  };
}
