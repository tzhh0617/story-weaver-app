import { z } from 'zod';

export const ModelSaveSchema = z.object({
  id: z.string(),
  provider: z.enum(['openai', 'anthropic']),
  modelName: z.string(),
  apiKey: z.string(),
  baseUrl: z.string(),
  config: z.record(z.string(), z.unknown()),
});

export type ModelSaveInput = z.infer<typeof ModelSaveSchema>;
