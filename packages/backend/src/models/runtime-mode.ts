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
  preferEnvironmentConfigs?: boolean;
};

export function createRuntimeMode(input: RuntimeModeInput) {
  const primaryConfigs = input.preferEnvironmentConfigs
    ? input.environmentConfigs
    : input.persistedConfigs;
  const fallbackConfigs = input.preferEnvironmentConfigs
    ? input.persistedConfigs
    : input.environmentConfigs;
  const mergedConfigs = [
    ...primaryConfigs,
    ...fallbackConfigs.filter(
      (fallbackConfig) =>
        !primaryConfigs.some((config) => config.id === fallbackConfig.id)
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
