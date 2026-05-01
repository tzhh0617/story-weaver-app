import {
  buildChapterAuditPrompt,
  buildRevisionPrompt,
} from './narrative/prompts.js';
import { parseJsonObject } from './narrative/json.js';
import { normalizeNarrativeStateDelta } from './narrative/state.js';
import type {
  NarrativeAudit,
  NarrativeStateDelta,
  ViralStoryProtocol,
} from './narrative/types.js';
import {
  normalizeChapterUpdate,
  normalizeCharacterStates,
  normalizePlotThreadUpdate,
  normalizeScene,
  parseJson,
} from './ai-post-chapter-helpers.js';
import type { ChapterUpdateJson } from './ai-post-chapter-helpers.js';

export function createAiSummaryGenerator(deps: {
  registry: {
    languageModel: (modelId: string) => unknown;
  };
  generateText: (input: {
    model: unknown;
    prompt: string;
  }) => Promise<{ text: string }>;
}) {
  return {
    async summarizeChapter(input: { modelId: string; content: string }) {
      const model = deps.registry.languageModel(input.modelId);
      const result = await deps.generateText({
        model,
        prompt: [
          'Summarize this chapter in 1-2 sentences for a progress panel.',
          `Chapter content:\n${input.content}`,
          'Return the summary only.',
        ].join('\n'),
      });

      return result.text.trim();
    },
  };
}

export function createAiChapterUpdateExtractor(deps: {
  registry: {
    languageModel: (modelId: string) => unknown;
  };
  generateText: (input: {
    model: unknown;
    prompt: string;
  }) => Promise<{ text: string }>;
}) {
  return {
    async extractChapterUpdate(input: {
      modelId: string;
      chapterIndex: number;
      content: string;
    }) {
      const model = deps.registry.languageModel(input.modelId);
      const result = await deps.generateText({
        model,
        prompt: [
          'Extract post-chapter continuity updates from this chapter as JSON.',
          `Chapter index: ${input.chapterIndex}`,
          `Chapter content:\n${input.content}`,
          'Return JSON with shape {"summary":"string","openedThreads":[{"id":"string","description":"string","plantedAt":number,"expectedPayoff":number or null,"importance":"critical|normal|minor"}],"resolvedThreadIds":["string"],"characterStates":[{"characterId":"string","characterName":"string","location":"string or null","status":"string or null","knowledge":"string or null","emotion":"string or null","powerLevel":"string or null"}],"scene":null or {"location":"string","timeInStory":"string","charactersPresent":["string"],"events":"string or null"}}.',
          'Use JSON null for absent optional values, never the string "null". Omit unusable records instead of returning blank ids or blank required fields.',
        ].join('\n'),
      });

      return normalizeChapterUpdate(parseJson<ChapterUpdateJson>(result.text));
    },
  };
}

export function createAiPlotThreadExtractor(deps: {
  registry: {
    languageModel: (modelId: string) => unknown;
  };
  generateText: (input: {
    model: unknown;
    prompt: string;
  }) => Promise<{ text: string }>;
}) {
  return {
    async extractThreads(input: {
      modelId: string;
      chapterIndex: number;
      content: string;
    }) {
      const model = deps.registry.languageModel(input.modelId);
      const result = await deps.generateText({
        model,
        prompt: [
          'Extract plot thread updates from this chapter as JSON.',
          `Chapter index: ${input.chapterIndex}`,
          `Chapter content:\n${input.content}`,
          'Return JSON with shape {"openedThreads":[{"id":"string","description":"string","plantedAt":number,"expectedPayoff":number or null,"importance":"critical|normal|minor"}],"resolvedThreadIds":["string"]}.',
          'Use JSON null for absent optional values, never the string "null". Omit unusable records instead of returning blank ids or blank required fields.',
        ].join('\n'),
      });

      return normalizePlotThreadUpdate(parseJson<{
        openedThreads?: unknown;
        resolvedThreadIds?: unknown;
      }>(result.text));
    },
  };
}

export function createAiCharacterStateExtractor(deps: {
  registry: {
    languageModel: (modelId: string) => unknown;
  };
  generateText: (input: {
    model: unknown;
    prompt: string;
  }) => Promise<{ text: string }>;
}) {
  return {
    async extractStates(input: {
      modelId: string;
      chapterIndex: number;
      content: string;
    }) {
      const model = deps.registry.languageModel(input.modelId);
      const result = await deps.generateText({
        model,
        prompt: [
          'Extract the latest character states from this chapter as JSON.',
          `Chapter index: ${input.chapterIndex}`,
          `Chapter content:\n${input.content}`,
          'Return a JSON array of {"characterId":"string","characterName":"string","location":"string or null","status":"string or null","knowledge":"string or null","emotion":"string or null","powerLevel":"string or null"}.',
          'Use JSON null for absent optional values, never the string "null". Omit unusable records instead of returning blank ids or blank required fields.',
        ].join('\n'),
      });

      return normalizeCharacterStates(parseJson<unknown>(result.text));
    },
  };
}

export function createAiSceneRecordExtractor(deps: {
  registry: {
    languageModel: (modelId: string) => unknown;
  };
  generateText: (input: {
    model: unknown;
    prompt: string;
  }) => Promise<{ text: string }>;
}) {
  return {
    async extractScene(input: {
      modelId: string;
      chapterIndex: number;
      content: string;
    }) {
      const model = deps.registry.languageModel(input.modelId);
      const result = await deps.generateText({
        model,
        prompt: [
          'Extract the latest scene record from this chapter as JSON.',
          `Chapter index: ${input.chapterIndex}`,
          `Chapter content:\n${input.content}`,
          'Return either null or {"location":"string","timeInStory":"string","charactersPresent":["string"],"events":"string or null"}.',
          'Use JSON null for absent optional values, never the string "null". Return null if the latest scene has no usable location, time, or present characters.',
        ].join('\n'),
      });

      return normalizeScene(parseJson<unknown>(result.text));
    },
  };
}

export function createAiChapterAuditor(deps: {
  registry: {
    languageModel: (modelId: string) => unknown;
  };
  generateText: (input: {
    model: unknown;
    prompt: string;
  }) => Promise<{ text: string }>;
}) {
  return {
    async auditChapter(input: {
      modelId: string;
      draft: string;
      auditContext: string;
      routePlanText?: string | null;
      viralStoryProtocol?: ViralStoryProtocol | null;
      chapterIndex?: number | null;
    }): Promise<NarrativeAudit> {
      const model = deps.registry.languageModel(input.modelId);
      const result = await deps.generateText({
        model,
        prompt: buildChapterAuditPrompt(input),
      });

      return parseJsonObject<NarrativeAudit>(result.text);
    },
  };
}

export function createAiChapterRevision(deps: {
  registry: {
    languageModel: (modelId: string) => unknown;
  };
  generateText: (input: {
    model: unknown;
    prompt: string;
  }) => Promise<{ text: string }>;
}) {
  return {
    async reviseChapter(input: {
      modelId: string;
      originalPrompt: string;
      draft: string;
      issues: NarrativeAudit['issues'];
    }) {
      const model = deps.registry.languageModel(input.modelId);
      const result = await deps.generateText({
        model,
        prompt: buildRevisionPrompt(input),
      });

      return result.text.trim();
    },
  };
}

export function createAiNarrativeStateExtractor(deps: {
  registry: {
    languageModel: (modelId: string) => unknown;
  };
  generateText: (input: {
    model: unknown;
    prompt: string;
  }) => Promise<{ text: string }>;
}) {
  return {
    async extractState(input: {
      modelId: string;
      content: string;
    }): Promise<NarrativeStateDelta> {
      const model = deps.registry.languageModel(input.modelId);
      const result = await deps.generateText({
        model,
        prompt: [
          'Extract structured narrative state changes from this chapter as JSON.',
          `Chapter content:\n${input.content}`,
          'Return JSON with characterStates, relationshipStates, threadUpdates, scene, themeProgression.',
        ].join('\n'),
      });

      return normalizeNarrativeStateDelta(
        parseJsonObject<Partial<NarrativeStateDelta>>(result.text)
      );
    },
  };
}
