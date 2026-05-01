import { createAnthropic } from '@ai-sdk/anthropic';

export function createAnthropicProvider(apiKey: string, baseURL?: string) {
  return createAnthropic({
    apiKey,
    baseURL: baseURL || undefined,
  });
}
