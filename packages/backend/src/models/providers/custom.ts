import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

export function createCompatibleProvider(input: {
  name: string;
  apiKey: string;
  baseURL: string;
}) {
  return createOpenAICompatible({
    name: input.name,
    apiKey: input.apiKey,
    baseURL: input.baseURL,
  });
}
