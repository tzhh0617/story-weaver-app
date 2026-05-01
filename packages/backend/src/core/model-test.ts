export function createModelTestService(deps: {
  registry: {
    languageModel: (modelId: string) => unknown;
  };
  generateText: (input: {
    model: unknown;
    prompt: string;
  }) => Promise<{ text: string }>;
  now?: () => number;
}) {
  const now = deps.now ?? Date.now;

  return {
    async testModel(modelId: string) {
      const startedAt = now();

      try {
        const model = deps.registry.languageModel(modelId);
        await deps.generateText({
          model,
          prompt: 'Reply with the single word pong.',
        });

        return {
          ok: true,
          latency: now() - startedAt,
          error: null,
        };
      } catch (error) {
        return {
          ok: false,
          latency: now() - startedAt,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  };
}
