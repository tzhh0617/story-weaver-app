import {
  type ModelConfigInput,
  validateModelConfig,
} from './config.js';

type RuntimeModeInput = {
  persistedConfigs: ModelConfigInput[];
  environmentConfigs: ModelConfigInput[];
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
    kind: 'real',
    availableConfigs,
    resolveModelId: () => {
      const modelId = availableConfigs[0]?.id;
      if (!modelId) {
        throw new Error('No model configured');
      }

      return modelId;
    },
  } as const;
}
