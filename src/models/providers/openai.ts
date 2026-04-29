import { createOpenAI } from '@ai-sdk/openai';

export function createOpenAIProvider(apiKey: string, baseURL?: string) {
  return createOpenAI({
    apiKey,
    baseURL: baseURL || undefined,
  });
}
