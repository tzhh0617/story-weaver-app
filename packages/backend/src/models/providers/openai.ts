import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

export function createOpenAIProvider(apiKey: string, baseURL?: string) {
  if (baseURL) {
    return createOpenAICompatible({
      name: 'openai',
      apiKey,
      baseURL,
    });
  }

  return createOpenAI({
    apiKey,
  });
}
