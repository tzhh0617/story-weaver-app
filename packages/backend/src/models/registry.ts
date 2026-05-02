import { createProviderRegistry } from 'ai';
import {
  type ModelConfigInput,
  validateModelConfig,
} from './config.js';
import { createAnthropicProvider } from './providers/anthropic.js';
import { createOpenAIProvider } from './providers/openai.js';

type ProviderRegistryInput = Parameters<typeof createProviderRegistry>[0];
type ProviderV3 = ProviderRegistryInput[string];
type RuntimeRegistry = ReturnType<typeof createProviderRegistry>;

export function createRuntimeRegistry(
  configs: ModelConfigInput[]
): RuntimeRegistry {
  const providers: Record<string, ProviderV3> = {};
  const normalizedConfigs = configs.map((config) => validateModelConfig(config));

  for (const config of normalizedConfigs) {
    switch (config.provider) {
      case 'openai':
        providers.openai = createOpenAIProvider(config.apiKey, config.baseUrl);
        break;
      case 'anthropic':
        providers.anthropic = createAnthropicProvider(
          config.apiKey,
          config.baseUrl
        );
        break;
    }
  }

  return createProviderRegistry(providers);
}
