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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function nullableString(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'null') {
    return null;
  }

  return trimmed;
}

function requiredString(value: unknown) {
  return nullableString(value);
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string' && value.trim().toLowerCase() === 'null') {
    return null;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeImportance(value: unknown) {
  const normalized = nullableString(value);
  return normalized === 'critical' ||
    normalized === 'normal' ||
    normalized === 'minor'
    ? normalized
    : 'normal';
}

function normalizeOpenedThread(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const id = requiredString(value.id);
  const description = requiredString(value.description);
  const plantedAt = nullableNumber(value.plantedAt);
  if (!id || !description || plantedAt === null) {
    return null;
  }

  return {
    id,
    description,
    plantedAt,
    expectedPayoff: nullableNumber(value.expectedPayoff),
    importance: normalizeImportance(value.importance),
  };
}

function normalizeCharacterState(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const characterId = requiredString(value.characterId);
  const characterName = requiredString(value.characterName);
  if (!characterId || !characterName) {
    return null;
  }

  return {
    characterId,
    characterName,
    location: nullableString(value.location),
    status: nullableString(value.status),
    knowledge: nullableString(value.knowledge),
    emotion: nullableString(value.emotion),
    powerLevel: nullableString(value.powerLevel),
  };
}

function normalizeScene(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const location = requiredString(value.location);
  const timeInStory = requiredString(value.timeInStory);
  const charactersPresent = Array.isArray(value.charactersPresent)
    ? value.charactersPresent
        .map((character) => requiredString(character))
        .filter((character): character is string => Boolean(character))
    : [];

  if (!location || !timeInStory || charactersPresent.length === 0) {
    return null;
  }

  return {
    location,
    timeInStory,
    charactersPresent,
    events: nullableString(value.events),
  };
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}

function normalizePlotThreadUpdate(update: {
  openedThreads?: unknown;
  resolvedThreadIds?: unknown;
}) {
  return {
    openedThreads: Array.isArray(update.openedThreads)
      ? update.openedThreads.map(normalizeOpenedThread).filter(isPresent)
      : [],
    resolvedThreadIds: Array.isArray(update.resolvedThreadIds)
      ? update.resolvedThreadIds
          .map((threadId) => requiredString(threadId))
          .filter((threadId): threadId is string => Boolean(threadId))
      : [],
  };
}

function normalizeCharacterStates(characterStates: unknown) {
  return Array.isArray(characterStates)
    ? characterStates.map(normalizeCharacterState).filter(isPresent)
    : [];
}

function normalizeChapterUpdate(update: ChapterUpdateJson) {
  const threadUpdate = normalizePlotThreadUpdate(update);

  return {
    summary: nullableString(update.summary) ?? '',
    openedThreads: threadUpdate.openedThreads,
    resolvedThreadIds: threadUpdate.resolvedThreadIds,
    characterStates: normalizeCharacterStates(update.characterStates),
    scene: normalizeScene(update.scene),
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
