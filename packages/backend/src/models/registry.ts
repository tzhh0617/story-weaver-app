import { createProviderRegistry } from 'ai';
import type { ProviderV3 } from '@ai-sdk/provider';
import {
  type ModelConfigInput,
  validateModelConfig,
} from './config.js';
import { createAnthropicProvider } from './providers/anthropic.js';
import { createOpenAIProvider } from './providers/openai.js';

export function createRuntimeRegistry(configs: ModelConfigInput[]) {
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
