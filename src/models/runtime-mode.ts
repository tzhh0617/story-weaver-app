import {
  type ModelConfigInput,
  validateModelConfig,
} from './config.js';

export const DEFAULT_MOCK_MODEL_ID = 'mock:fallback';

export function isMockModelId(modelId: string) {
  return modelId.startsWith('mock:');
}

type RuntimeModeInput = {
  persistedConfigs: ModelConfigInput[];
  environmentConfigs: ModelConfigInput[];
  fallbackModelId: string;
};

export function createRuntimeMode(input: RuntimeModeInput) {
  const mergedConfigs = [
    ...input.persistedConfigs,
    ...input.environmentConfigs.filter(
      (envConfig) =>
        !input.persistedConfigs.some((config) => config.id === envConfig.id)
    ),
  ];

  const availableConfigs = mergedConfigs.filter((config) => {
    try {
      validateModelConfig(config);
      return true;
    } catch {
      return false;
    }
  });

  return {
    kind: availableConfigs.length > 0 ? 'real' : 'mock',
    availableConfigs,
    resolveModelId: () => availableConfigs[0]?.id ?? input.fallbackModelId,
  } as const;
}
