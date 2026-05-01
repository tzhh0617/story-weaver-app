import { buildTitlePrompt } from '../prompt-builder.js';
import { normalizeGeneratedTitle } from './rendering.js';
import type { OutlineGenerationInput, OutlineBundle } from '../types.js';
import { generateBibleBasedBundle } from './bible-based-outline-generator.js';
import { generateFallbackBundle } from './fallback-outline-generator.js';

export function createAiOutlineService(deps: {
  registry: {
    languageModel: (modelId: string) => unknown;
  };
  generateText: (input: {
    model: unknown;
    prompt: string;
  }) => Promise<{ text: string }>;
}) {
  return {
    async generateTitleFromIdea(
      input: OutlineGenerationInput & { modelId: string }
    ): Promise<string> {
      const model = deps.registry.languageModel(input.modelId);

      return normalizeGeneratedTitle(
        (
          await deps.generateText({
            model,
            prompt: buildTitlePrompt(input),
          })
        ).text
      );
    },

    async generateFromIdea(
      input: OutlineGenerationInput & { modelId: string }
    ): Promise<OutlineBundle> {
      const model = deps.registry.languageModel(input.modelId);
      const ctx = {
        generateText: deps.generateText,
        model,
        input,
      };

      const bibleBundle = await generateBibleBasedBundle(ctx);
      if (bibleBundle) {
        return bibleBundle;
      }

      return generateFallbackBundle(ctx);
    },
  };
}
