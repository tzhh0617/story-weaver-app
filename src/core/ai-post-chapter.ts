function stripCodeFences(text: string) {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) {
    return trimmed;
  }

  return trimmed
    .replace(/^```[a-zA-Z]*\n?/, '')
    .replace(/\n?```$/, '')
    .trim();
}

function parseJson<T>(text: string): T {
  return JSON.parse(stripCodeFences(text)) as T;
}

type ChapterUpdateJson = {
  summary?: string;
  openedThreads?: Array<{
    id: string;
    description: string;
    plantedAt: number;
    expectedPayoff: number | null;
    importance: string;
  }>;
  resolvedThreadIds?: string[];
  characterStates?: Array<{
    characterId: string;
    characterName: string;
    location: string | null;
    status: string | null;
    knowledge: string | null;
    emotion: string | null;
    powerLevel: string | null;
  }>;
  scene?: {
    location: string;
    timeInStory: string;
    charactersPresent: string[];
    events: string | null;
  } | null;
};

function normalizeChapterUpdate(update: ChapterUpdateJson) {
  return {
    summary: update.summary ?? '',
    openedThreads: Array.isArray(update.openedThreads)
      ? update.openedThreads
      : [],
    resolvedThreadIds: Array.isArray(update.resolvedThreadIds)
      ? update.resolvedThreadIds
      : [],
    characterStates: Array.isArray(update.characterStates)
      ? update.characterStates
      : [],
    scene: update.scene ?? null,
  };
}

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
          'Return JSON with shape {"summary":"string","openedThreads":[{"id":"string","description":"string","plantedAt":number,"expectedPayoff":number|null,"importance":"critical|normal|minor"}],"resolvedThreadIds":["string"],"characterStates":[{"characterId":"string","characterName":"string","location":"string|null","status":"string|null","knowledge":"string|null","emotion":"string|null","powerLevel":"string|null"}],"scene":null|{"location":"string","timeInStory":"string","charactersPresent":["string"],"events":"string|null"}}.',
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
          'Return JSON with shape {"openedThreads":[{"id":"string","description":"string","plantedAt":number,"expectedPayoff":number|null,"importance":"critical|normal|minor"}],"resolvedThreadIds":["string"]}.',
        ].join('\n'),
      });

      return parseJson<{
        openedThreads: Array<{
          id: string;
          description: string;
          plantedAt: number;
          expectedPayoff: number | null;
          importance: string;
        }>;
        resolvedThreadIds: string[];
      }>(result.text);
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
          'Return a JSON array of {"characterId":"string","characterName":"string","location":"string|null","status":"string|null","knowledge":"string|null","emotion":"string|null","powerLevel":"string|null"}.',
        ].join('\n'),
      });

      return parseJson<
        Array<{
          characterId: string;
          characterName: string;
          location: string | null;
          status: string | null;
          knowledge: string | null;
          emotion: string | null;
          powerLevel: string | null;
        }>
      >(result.text);
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
          'Return either null or {"location":"string","timeInStory":"string","charactersPresent":["string"],"events":"string|null"}.',
        ].join('\n'),
      });

      return parseJson<{
        location: string;
        timeInStory: string;
        charactersPresent: string[];
        events: string | null;
      } | null>(result.text);
    },
  };
}
